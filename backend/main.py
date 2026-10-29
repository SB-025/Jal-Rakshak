import hashlib
import hmac
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal
from datetime import date

import jwt
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field, model_validator
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError
from starlette.responses import JSONResponse
from diagnostics_service import cloud_status, run_diagnosis
from model_service import demo_training_rows, model_status, train_bundle
from chat_service import chat_turn
from motor_state_service import StateConflict, change_state, state_view

load_dotenv(Path(__file__).with_name('.env'))
client = None
database = None
security = HTTPBearer(auto_error=False)


@asynccontextmanager
async def lifespan(app):
    global client, database
    uri = os.getenv('MONGODB_URI', '').strip()
    if uri:
        try:
            client = MongoClient(uri, serverSelectionTimeoutMS=5000, tz_aware=True)
            database = client[os.getenv('MONGODB_DB', 'jal_rakshak')]
            database.motors.create_index('motor_oid', unique=True)
            database.readings.create_index([('motor_id', 1), ('recorded_at', -1)])
            database.alert_actions.create_index('alert_id', unique=True)
            database.diagnoses.create_index([('motor_id', 1), ('created_at', -1)])
            database.diagnostic_chats.create_index([('motor_id', 1), ('report_id', 1), ('created_at', -1)])
            database.motor_states.create_index('motor_id', unique=True)
        except PyMongoError:
            database = None
    yield
    database = None
    if client is not None:
        client.close()


app = FastAPI(title='Jal Rakshak API', lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(','),
    allow_credentials=False, allow_methods=['GET', 'POST', 'PATCH'], allow_headers=['Authorization', 'Content-Type'],
)


@app.exception_handler(PyMongoError)
async def database_error(request, exc):
    return JSONResponse(status_code=503, content={'detail': 'Database unavailable. Check MongoDB Atlas configuration and connectivity.'})


def get_db():
    if database is None:
        raise HTTPException(503, 'MongoDB is not connected. Configure MONGODB_URI in backend/.env and restart.')
    return database


def require_user(credentials: HTTPAuthorizationCredentials | None = Depends(security)):
    unauthorized = HTTPException(401, 'Invalid or expired login token', headers={'WWW-Authenticate': 'Bearer'})
    if credentials is None or credentials.scheme.lower() != 'bearer':
        raise unauthorized
    try:
        payload = jwt.decode(credentials.credentials, os.environ['JWT_SECRET'], algorithms=['HS256'], options={'require': ['exp', 'iat', 'sub']})
        if payload['sub'] != os.getenv('LOGIN_USERNAME'):
            raise unauthorized
        return payload['sub']
    except (jwt.InvalidTokenError, KeyError):
        raise unauthorized


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True, allow_inf_nan=False)


class Login(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=256)


class Coordinates(StrictModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class Motor(StrictModel):
    motor_name: str = Field(min_length=1, max_length=120)
    coordinates: Coordinates
    size: str = Field(min_length=1, max_length=100, description='Size and unit, e.g. 5 HP')
    motor_oid: str = Field(min_length=1, max_length=100, description='Your unique external motor identifier')
    source: Literal['demo', 'manual', 'hardware'] = 'manual'


class Reading(StrictModel):
    motor_id: str = Field(min_length=1, max_length=100, description='MongoDB motor id or registered motor_oid')
    voltage: float = Field(ge=0)
    waterflow: float = Field(ge=0, description='Water flow in litres/minute')
    density: float = Field(ge=0, description='Density in kg/m^3')
    temperature: float = Field(ge=-273.15, description='Motor temperature in Celsius')
    environment_temperature: float = Field(ge=-273.15, description='Ambient temperature in Celsius')
    humidity: float = Field(ge=0, le=100)
    vibration_rms: float | None = Field(default=None, ge=0, description='Optional vibration RMS in mm/s; omit if sensor is not installed')
    current: float | None = Field(default=None, ge=0, description='Optional current in amperes; omit if unavailable')
    pressure: float | None = Field(default=None, ge=0, description='Optional discharge pressure in bar; omit if unavailable')
    source: Literal['demo', 'manual', 'hardware'] = 'manual'
    measured_at: datetime | None = None

    @model_validator(mode='after')
    def validate_time(self):
        if self.measured_at is not None:
            if self.measured_at.tzinfo is None:
                raise ValueError('measured_at must include a timezone')
            if self.measured_at > datetime.now(timezone.utc) + timedelta(minutes=1):
                raise ValueError('measured_at cannot be in the future')
        return self


def serialize(document):
    result = dict(document)
    result['id'] = str(result.pop('_id'))
    return result


def find_motor(db, motor_id):
    # External identifiers take precedence, including identifiers shaped like ObjectIds.
    motor = db.motors.find_one({'motor_oid': motor_id})
    if motor is None and ObjectId.is_valid(motor_id):
        motor = db.motors.find_one({'_id': ObjectId(motor_id)})
    if motor is None:
        raise HTTPException(404, 'Motor not found')
    return motor


@app.get('/')
def root():
    return {'message': 'Jal Rakshak API', 'docs': '/docs'}


@app.get('/health')
def health():
    connected = False
    if database is not None:
        try:
            database.command('ping')
            connected = True
        except PyMongoError:
            pass
    return {'status': 'ok' if connected else 'degraded', 'database': 'connected' if connected else 'unavailable'}


@app.post('/auth/login')
def login(body: Login):
    stored = os.getenv('LOGIN_PASSWORD_HASH', '')
    secret = os.getenv('JWT_SECRET', '')
    if not stored or len(secret) < 32:
        raise HTTPException(503, 'Login configuration is missing')
    try:
        salt, expected = stored.split(':', 1)
        actual = hashlib.pbkdf2_hmac('sha256', body.password.encode(), bytes.fromhex(salt), 600000).hex()
    except ValueError:
        raise HTTPException(503, 'Login configuration is invalid')
    if not (hmac.compare_digest(actual, expected) and hmac.compare_digest(body.username.encode(), os.getenv('LOGIN_USERNAME', '').encode())):
        raise HTTPException(401, 'Incorrect username or password', headers={'WWW-Authenticate': 'Bearer'})
    now = datetime.now(timezone.utc)
    token = jwt.encode({'sub': body.username, 'iat': now, 'exp': now + timedelta(hours=1)}, secret, algorithm='HS256')
    return {'access_token': token, 'token_type': 'bearer', 'expires_in': 3600}


@app.post('/motors', status_code=201, dependencies=[Depends(require_user)])
def create_motor(body: Motor, db=Depends(get_db)):
    document = body.model_dump()
    document['created_at'] = datetime.now(timezone.utc)
    try:
        result = db.motors.insert_one(document)
    except DuplicateKeyError:
        raise HTTPException(409, 'A motor with this motor_oid already exists')
    document['_id'] = result.inserted_id
    return serialize(document)


@app.get('/motors', dependencies=[Depends(require_user)])
def list_motors(skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500), db=Depends(get_db)):
    return {'items': [serialize(item) for item in db.motors.find().sort([('created_at', -1), ('_id', -1)]).skip(skip).limit(limit)], 'total': db.motors.count_documents({}), 'skip': skip, 'limit': limit}


@app.post('/readings', status_code=201, dependencies=[Depends(require_user)])
def create_reading(body: Reading, db=Depends(get_db)):
    motor = find_motor(db, body.motor_id)
    document = body.model_dump(exclude={'measured_at'})
    if motor.get('source') == 'demo':
        document['source'] = 'demo'
    document['motor_id'] = str(motor['_id'])
    document['recorded_at'] = body.measured_at or datetime.now(timezone.utc)
    document['received_at'] = datetime.now(timezone.utc)
    result = db.readings.insert_one(document)
    document['_id'] = result.inserted_id
    return serialize(document)


@app.get('/motors/{motor_id}', dependencies=[Depends(require_user)])
def motor_details(motor_id: str, skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500), db=Depends(get_db)):
    motor = find_motor(db, motor_id)
    query = {'motor_id': str(motor['_id'])}
    latest = db.readings.find_one(query, sort=[('recorded_at', -1), ('_id', -1)])
    return {**serialize(motor), 'latest_reading': serialize(latest) if latest else None, 'readings': [serialize(item) for item in db.readings.find(query).sort([('recorded_at', -1), ('_id', -1)]).skip(skip).limit(limit)], 'total_readings': db.readings.count_documents(query), 'skip': skip, 'limit': limit}


class Thresholds(StrictModel):
    temperature_warning: float = Field(default=65, ge=-273.15)
    temperature_critical: float = Field(default=80, ge=-273.15)
    flow_minimum: float = Field(default=20, ge=0)
    voltage_minimum: float = Field(default=200, ge=0)
    voltage_maximum: float = Field(default=250, ge=0)

    @model_validator(mode='after')
    def validate_ranges(self):
        if self.temperature_critical <= self.temperature_warning:
            raise ValueError('Critical temperature must exceed warning temperature')
        if self.voltage_maximum <= self.voltage_minimum:
            raise ValueError('Maximum voltage must exceed minimum voltage')
        return self


@app.get('/settings', dependencies=[Depends(require_user)])
def read_settings(db=Depends(get_db)):
    record = db.settings.find_one({'_id': 'thresholds'})
    return {key: record.get(key, value) for key, value in Thresholds().model_dump().items()} if record else Thresholds().model_dump()


@app.post('/settings', dependencies=[Depends(require_user)])
def save_settings(body: Thresholds, db=Depends(get_db)):
    db.settings.update_one({'_id': 'thresholds'}, {'$set': body.model_dump()}, upsert=True)
    return body


class WorkOrder(StrictModel):
    motor_id: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=200)
    notes: str = Field(default='', max_length=3000)
    scheduled_date: date
    status: Literal['scheduled', 'in_progress', 'completed'] = 'scheduled'


@app.get('/maintenance', dependencies=[Depends(require_user)])
def list_maintenance(db=Depends(get_db)):
    return [serialize(item) for item in db.maintenance.find().sort([('created_at', -1), ('_id', -1)])]


@app.post('/maintenance', status_code=201, dependencies=[Depends(require_user)])
def create_work_order(body: WorkOrder, db=Depends(get_db)):
    motor = find_motor(db, body.motor_id)
    document = body.model_dump(mode='json')
    document['motor_id'] = str(motor['_id'])
    document['created_at'] = datetime.now(timezone.utc)
    document['_id'] = db.maintenance.insert_one(document).inserted_id
    return serialize(document)


class WorkStatus(StrictModel):
    status: Literal['scheduled', 'in_progress', 'completed']


@app.patch('/maintenance/{work_id}', dependencies=[Depends(require_user)])
def update_work_order(work_id: str, body: WorkStatus, db=Depends(get_db)):
    if not ObjectId.is_valid(work_id):
        raise HTTPException(404, 'Work order not found')
    result = db.maintenance.update_one({'_id': ObjectId(work_id)}, {'$set': {'status': body.status, 'updated_at': datetime.now(timezone.utc)}})
    if not result.matched_count:
        raise HTTPException(404, 'Work order not found')
    return serialize(db.maintenance.find_one({'_id': ObjectId(work_id)}))


class AlertAction(StrictModel):
    alert_id: str = Field(min_length=1, max_length=160)
    motor_id: str = Field(min_length=1, max_length=100)
    status: Literal['open', 'acknowledged', 'resolved']


@app.get('/alert-actions', dependencies=[Depends(require_user)])
def list_alert_actions(db=Depends(get_db)):
    return [serialize(item) for item in db.alert_actions.find()]


@app.post('/alert-actions', dependencies=[Depends(require_user)])
def save_alert_action(body: AlertAction, db=Depends(get_db)):
    motor = find_motor(db, body.motor_id)
    reading_id, separator, rule = body.alert_id.partition('-')
    if not separator or rule not in {'temperature', 'flow', 'voltage'} or not ObjectId.is_valid(reading_id):
        raise HTTPException(422, 'Invalid alert identifier')
    if not db.readings.find_one({'_id': ObjectId(reading_id), 'motor_id': str(motor['_id'])}):
        raise HTTPException(404, 'Alert reading not found for this motor')
    document = {**body.model_dump(), 'motor_id': str(motor['_id']), 'updated_at': datetime.now(timezone.utc)}
    db.alert_actions.update_one({'alert_id': body.alert_id}, {'$set': document}, upsert=True)
    return serialize(db.alert_actions.find_one({'alert_id': body.alert_id}))


@app.get('/diagnostics/status', dependencies=[Depends(require_user)])
def diagnostics_status():
    return {'cloud': cloud_status(), 'models': model_status(), 'confirmed_fault_diagnosis': False,
            'component_sensor_requirements': ['vibration_rms', 'current', 'pressure'],
            'message': 'Models suggest condition patterns and inspection priorities; they cannot confirm a damaged component.'}


class DemoTraining(StrictModel):
    demo_only: Literal[True]


@app.post('/models/train-demo', dependencies=[Depends(require_user)])
def train_demo_models(body: DemoTraining):
    return train_bundle(demo_training_rows(), 'demo')


class DiagnosisRequest(StrictModel):
    use_cloud: bool = True
    horizon_minutes: int = Field(default=60, ge=5, le=60)


@app.post('/motors/{motor_id}/diagnose', status_code=201, dependencies=[Depends(require_user)])
def diagnose_motor(motor_id: str, body: DiagnosisRequest, db=Depends(get_db)):
    motor = find_motor(db, motor_id)
    try:
        return run_diagnosis(db, motor, read_settings(db), body.horizon_minutes, body.use_cloud)
    except ValueError as exc:
        raise HTTPException(409, str(exc))


@app.get('/motors/{motor_id}/diagnoses', dependencies=[Depends(require_user)])
def diagnosis_history(motor_id: str, skip: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100), db=Depends(get_db)):
    motor = find_motor(db, motor_id)
    query = {'motor_id': str(motor['_id'])}
    return {'items': [serialize(item) for item in db.diagnoses.find(query).sort([('created_at', -1), ('_id', -1)]).skip(skip).limit(limit)],
            'total': db.diagnoses.count_documents(query), 'skip': skip, 'limit': limit}


class ChatRequest(StrictModel):
    message: str = Field(min_length=1, max_length=2000)
    report_id: str = Field(min_length=24, max_length=24)


def find_report(db, motor, report_id):
    if not ObjectId.is_valid(report_id):
        raise HTTPException(404, 'Diagnostic report not found')
    report = db.diagnoses.find_one({'_id': ObjectId(report_id), 'motor_id': str(motor['_id'])})
    if report is None:
        raise HTTPException(404, 'Diagnostic report not found for this motor')
    return report


@app.post('/motors/{motor_id}/chat', status_code=201, dependencies=[Depends(require_user)])
def diagnostic_chat(motor_id: str, body: ChatRequest, db=Depends(get_db)):
    motor = find_motor(db, motor_id)
    report = find_report(db, motor, body.report_id)
    return chat_turn(db, motor, report, body.message)


@app.get('/motors/{motor_id}/chat', dependencies=[Depends(require_user)])
def diagnostic_chat_history(motor_id: str, report_id: str, limit: int = Query(30, ge=1, le=100), db=Depends(get_db)):
    motor = find_motor(db, motor_id)
    report = find_report(db, motor, report_id)
    query = {'motor_id': str(motor['_id']), 'report_id': str(report['_id'])}
    return {'items': [serialize(item) for item in list(db.diagnostic_chats.find(query).sort([('created_at', -1), ('_id', -1)]).limit(limit))[::-1]],
            'total': db.diagnostic_chats.count_documents(query)}


class MotorStateChange(StrictModel):
    state: Literal['on', 'off']
    source: Literal['operator', 'device'] = 'operator'
    command_id: str | None = Field(default=None, min_length=24, max_length=24)
    reported_at: datetime | None = None
    reason: str = Field(default='', max_length=500)

    @model_validator(mode='after')
    def validate_device_fields(self):
        if self.source == 'operator' and (self.command_id is not None or self.reported_at is not None):
            raise ValueError('command_id and reported_at are only allowed for device reports')
        if self.command_id is not None and not ObjectId.is_valid(self.command_id):
            raise ValueError('command_id must be a valid returned command identifier')
        if self.reported_at is not None:
            if self.reported_at.tzinfo is None:
                raise ValueError('reported_at must include a timezone')
            if self.reported_at > datetime.now(timezone.utc):
                raise ValueError('reported_at cannot be in the future')
        return self


@app.get('/motor-states', dependencies=[Depends(require_user)])
def get_motor_states(motor_id: str | None = None, state: Literal['on', 'off', 'unknown'] | None = None,
                     include_demo: bool = True, skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500), db=Depends(get_db)):
    motors = [find_motor(db, motor_id)] if motor_id else list(db.motors.find().sort('_id', 1))
    if not include_demo:
        motors = [motor for motor in motors if motor.get('source') != 'demo']
    identifiers = [str(motor['_id']) for motor in motors]
    documents = {item['motor_id']: item for item in db.motor_states.find({'motor_id': {'$in': identifiers}})}
    items = [state_view(motor, documents.get(str(motor['_id']))) for motor in motors]
    if state is not None:
        items = [item for item in items if item['state'] == state]
    return {'items': items[skip:skip + limit], 'total': len(items), 'skip': skip, 'limit': limit}


@app.post('/motors/{motor_id}/state', dependencies=[Depends(require_user)])
def set_motor_state(motor_id: str, body: MotorStateChange, actor=Depends(require_user), db=Depends(get_db)):
    motor = find_motor(db, motor_id)
    try:
        return change_state(db, motor, body.state, body.source, actor, body.command_id, body.reported_at, body.reason)
    except StateConflict as exc:
        raise HTTPException(409, str(exc))
