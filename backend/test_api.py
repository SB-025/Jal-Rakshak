import hashlib
import os
from datetime import datetime, timedelta, timezone

import jwt
import mongomock
import pytest
from fastapi.testclient import TestClient

import main


@pytest.fixture
def api(monkeypatch):
    salt = bytes.fromhex('12' * 16)
    monkeypatch.setenv('LOGIN_USERNAME', 'test-user')
    monkeypatch.setenv('LOGIN_PASSWORD_HASH', salt.hex() + ':' + hashlib.pbkdf2_hmac('sha256', b'test-password', salt, 600000).hex())
    monkeypatch.setenv('JWT_SECRET', 'test-secret-that-is-at-least-32-characters')
    monkeypatch.setenv('MONGODB_URI', '')
    db = mongomock.MongoClient().test
    db.motors.create_index('motor_oid', unique=True)
    main.app.dependency_overrides[main.get_db] = lambda: db
    with TestClient(main.app) as client:
        yield client
    main.app.dependency_overrides.clear()


def auth(api):
    response = api.post('/auth/login', json={'username': 'test-user', 'password': 'test-password'})
    assert response.status_code == 200
    return {'Authorization': 'Bearer ' + response.json()['access_token']}


def motor_body():
    return {'motor_name': 'Pump 1', 'coordinates': {'latitude': 19.07, 'longitude': 72.87}, 'size': '5 HP', 'motor_oid': 'MOTOR-001'}


def test_login_and_protection(api):
    assert api.post('/auth/login', json={'username': 'test-user', 'password': 'wrong'}).status_code == 401
    assert api.get('/motors').status_code == 401
    assert api.get('/motors', headers={'Authorization': 'Bearer broken'}).status_code == 401
    token = jwt.encode({'sub': 'test-user', 'iat': datetime.now(timezone.utc) - timedelta(hours=2), 'exp': datetime.now(timezone.utc) - timedelta(hours=1)}, os.environ['JWT_SECRET'], algorithm='HS256')
    assert api.get('/motors', headers={'Authorization': 'Bearer ' + token}).status_code == 401
    assert api.get('/motors', headers=auth(api)).status_code == 200


def test_motor_and_reading_lifecycle(api):
    headers = auth(api)
    created = api.post('/motors', json=motor_body(), headers=headers)
    assert created.status_code == 201
    motor = created.json()
    assert api.post('/motors', json=motor_body(), headers=headers).status_code == 409
    listing = api.get('/motors', headers=headers).json()
    assert listing['total'] == 1 and listing['items'][0]['id'] == motor['id']
    reading = {'motor_id': 'MOTOR-001', 'voltage': 230, 'waterflow': 40, 'density': 1000, 'temperature': 52, 'environment_temperature': 30, 'humidity': 65}
    saved = api.post('/readings', json=reading, headers=headers)
    assert saved.status_code == 201 and saved.json()['motor_id'] == motor['id']
    reading['motor_id'] = motor['id']
    assert api.post('/readings', json=reading, headers=headers).status_code == 201
    for identifier in [motor['id'], 'MOTOR-001']:
        details = api.get('/motors/' + identifier + '?limit=1', headers=headers).json()
        assert details['motor_name'] == 'Pump 1'
        assert details['total_readings'] == 2 and len(details['readings']) == 1
        assert details['latest_reading']['voltage'] == 230
    assert api.get('/motors/unknown', headers=headers).status_code == 404
    reading['motor_id'] = 'unknown'
    assert api.post('/readings', json=reading, headers=headers).status_code == 404


def test_validation_and_missing_database(api):
    headers = auth(api)
    invalid = motor_body()
    invalid['coordinates']['latitude'] = 200
    assert api.post('/motors', json=invalid, headers=headers).status_code == 422
    reading = {'motor_id': 'test', 'voltage': -1, 'waterflow': 40, 'density': 1000, 'temperature': 52, 'environment_temperature': 30, 'humidity': 101}
    assert api.post('/readings', json=reading, headers=headers).status_code == 422
    assert api.get('/motors?limit=0', headers=headers).status_code == 422
    main.app.dependency_overrides.clear()
    assert api.get('/motors', headers=headers).status_code == 503
    assert api.get('/health').json()['database'] == 'unavailable'


def test_operator_actions_and_settings_persist(api):
    headers = auth(api)
    motor = api.post('/motors', json={**motor_body(), 'source': 'demo'}, headers=headers).json()
    reading = {'motor_id': motor['id'], 'voltage': 230, 'waterflow': 12, 'density': 1000, 'temperature': 73, 'environment_temperature': 30, 'humidity': 65, 'source': 'hardware', 'measured_at': '2026-01-01T12:00:00Z'}
    response = api.post('/readings', json=reading, headers=headers)
    assert response.status_code == 201
    assert response.json()['source'] == 'demo'
    assert response.json()['recorded_at'].startswith('2026-01-01T12:00:00')
    alert_id = response.json()['id'] + '-temperature'
    action = {'motor_id': motor['id'], 'alert_id': alert_id, 'status': 'acknowledged'}
    assert api.post('/alert-actions', json=action, headers=headers).status_code == 200
    action['status'] = 'resolved'
    assert api.post('/alert-actions', json=action, headers=headers).status_code == 200
    actions = api.get('/alert-actions', headers=headers).json()
    assert len(actions) == 1 and actions[0]['status'] == 'resolved'
    action['alert_id'] = 'made-up-event'
    assert api.post('/alert-actions', json=action, headers=headers).status_code == 422
    body = {'motor_id': motor['id'], 'title': 'Inspect inlet', 'notes': 'Demo scenario', 'scheduled_date': '2026-11-01', 'status': 'scheduled'}
    work = api.post('/maintenance', json=body, headers=headers)
    assert work.status_code == 201
    work_id = work.json()['id']
    assert api.patch('/maintenance/' + work_id, json={'status': 'completed'}, headers=headers).json()['status'] == 'completed'
    assert api.get('/maintenance', headers=headers).json()[0]['status'] == 'completed'
    assert api.patch('/maintenance/not-an-id', json={'status': 'completed'}, headers=headers).status_code == 404
    thresholds = api.get('/settings', headers=headers).json()
    thresholds['temperature_warning'] = 60
    assert api.post('/settings', json=thresholds, headers=headers).status_code == 200
    assert api.get('/settings', headers=headers).json()['temperature_warning'] == 60
    thresholds['temperature_critical'] = 50
    assert api.post('/settings', json=thresholds, headers=headers).status_code == 422
    reading['measured_at'] = '2099-01-01T00:00:00Z'
    assert api.post('/readings', json=reading, headers=headers).status_code == 422
    for route in ['/settings', '/maintenance', '/alert-actions']:
        assert api.get(route).status_code == 401
