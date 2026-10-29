"""Idempotently POST clearly labelled demo motors, readings, and a work order."""
import json
import math
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name('.env'))
BASE_URL = os.getenv('SEED_API_URL', 'http://127.0.0.1:8000').rstrip('/')


def call(path, method='GET', body=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    request = Request(BASE_URL + path, method=method, headers=headers, data=json.dumps(body).encode() if body is not None else None)
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def seed(password):
    token = call('/auth/login', 'POST', {'username': os.getenv('LOGIN_USERNAME', 'niox'), 'password': password})['access_token']
    motors = []
    for skip in range(0, 100000, 500):
        page = call(f'/motors?skip={skip}&limit=500', token=token)
        motors.extend(page['items'])
        if len(motors) >= page['total']:
            break
    definitions = [
        ('DEMO-WORLI-01', 'Worli · Intake pump', 19.0176, 72.8162, '7.5 HP'),
        ('DEMO-DADAR-02', 'Dadar · Booster pump', 19.018, 72.842, '5 HP'),
        ('DEMO-BANDRA-03', 'Bandra · Transfer pump', 19.06, 72.835, '10 HP'),
    ]
    added_motors = added_readings = 0
    seeded = []
    for index, (oid, name, lat, lng, size) in enumerate(definitions):
        motor = next((item for item in motors if item['motor_oid'] == oid), None)
        if motor is None:
            motor = call('/motors', 'POST', {'motor_name': name, 'motor_oid': oid, 'coordinates': {'latitude': lat, 'longitude': lng}, 'size': size, 'source': 'demo'}, token)
            added_motors += 1
        if motor.get('source') != 'demo':
            raise RuntimeError('A seed identifier belongs to non-demo equipment; no readings added for that motor.')
        details = call('/motors/' + motor['id'] + '?limit=500', token=token)
        times = {datetime.fromisoformat(r['recorded_at'].replace('Z', '+00:00')) for r in details['readings']}
        base = datetime.fromisoformat(motor['created_at'].replace('Z', '+00:00')).replace(second=0, microsecond=0)
        for n in range(24):
            recorded = base - timedelta(minutes=(23 - n) * 15)
            if recorded in times:
                continue
            reading = {'motor_id': motor['id'], 'source': 'demo', 'voltage': round(230 + math.sin(n * .7) * 4, 1), 'waterflow': round(35 - n * .75 if index == 1 else 44 + math.sin(n * .8) * 3, 1), 'density': 998.2, 'temperature': round(53 + n * .9 if index == 1 else 45 + math.sin(n * .4) * 3 + index * 4, 1), 'environment_temperature': 29.6, 'humidity': 64, 'measured_at': recorded.isoformat()}
            call('/readings', 'POST', reading, token)
            added_readings += 1
        seeded.append(motor)
    work = call('/maintenance', token=token)
    title = '[DEMO] Inspect inlet and motor cooling'
    if not any(item['title'] == title and item['motor_id'] == seeded[1]['id'] for item in work):
        call('/maintenance', 'POST', {'motor_id': seeded[1]['id'], 'title': title, 'notes': 'SIMULATED SCENARIO. Inspect intake obstruction and cooling airflow after elevated temperature and reduced flow. No hardware fault has been confirmed.', 'scheduled_date': (datetime.now(timezone.utc) + timedelta(days=1)).date().isoformat(), 'status': 'scheduled'}, token)
    for motor in seeded:
        details = call('/motors/' + motor['id'], token=token)
        assert details['total_readings'] >= 24 and details['source'] == 'demo'
    print(f'Atlas demo seed verified: {len(seeded)} simulated pumps; added {added_motors} motors and {added_readings} readings.')
    print('One demo inspection work order is available. Existing records were preserved.')


if __name__ == '__main__':
    import getpass
    try:
        seed(getpass.getpass('Application password: '))
    except HTTPError as exc:
        print(f'Seeding failed: HTTP {exc.code}. Check the running API and login.', file=sys.stderr)
        sys.exit(1)
