"""POST one rich-sensor DEMO bearing scenario, without changing existing equipment."""
import math
from datetime import datetime, timedelta, timezone

from seed_demo import call


def seed_ai(password):
    from dotenv import dotenv_values
    username = dotenv_values('.env').get('LOGIN_USERNAME', 'niox')
    token = call('/auth/login', 'POST', {'username': username, 'password': password})['access_token']
    motors = call('/motors?limit=500', token=token)['items']
    motor = next((motor for motor in motors if motor['motor_oid'] == 'DEMO-AI-BEARING-04'), None)
    if motor is None:
        motor = call('/motors', 'POST', {'motor_name': 'AI lab · Bearing scenario', 'motor_oid': 'DEMO-AI-BEARING-04', 'coordinates': {'latitude': 19.1136, 'longitude': 72.8697}, 'size': '5 HP · simulated', 'source': 'demo'}, token)
    if motor.get('source') != 'demo':
        raise RuntimeError('Demo identifier is assigned to non-demo equipment')
    details = call('/motors/' + motor['id'] + '?limit=500', token=token)
    existing = {datetime.fromisoformat(row['recorded_at'].replace('Z', '+00:00')) for row in details['readings']}
    origin = datetime.fromisoformat(motor['created_at'].replace('Z', '+00:00')).replace(second=0, microsecond=0)
    added = 0
    for n in range(24):
        time = origin - timedelta(minutes=(23 - n) * 5)
        if time in existing:
            continue
        call('/readings', 'POST', {'motor_id': motor['id'], 'source': 'demo', 'voltage': round(230 + math.sin(n) * 1.2, 2), 'waterflow': round(44 - n * .04, 2), 'density': 998.2, 'temperature': round(53 + n * .75, 2), 'environment_temperature': 30, 'humidity': 62, 'vibration_rms': round(4 + n * .13, 2), 'current': round(5.5 + n * .04, 2), 'pressure': 2.7, 'measured_at': time.isoformat()}, token)
        added += 1
    print(f'Rich-sensor DEMO motor verified: {motor["motor_oid"]}; added {added} readings.')
    return motor['id']


if __name__ == '__main__':
    import getpass
    seed_ai(getpass.getpass('Application password: '))
