from datetime import datetime, timedelta, timezone

from test_api import api, auth, motor_body


def test_unknown_state_and_auth(api):
    headers = auth(api)
    motor = api.post('/motors', json=motor_body(), headers=headers).json()
    assert api.get('/motor-states').status_code == 401
    assert api.post('/motors/' + motor['id'] + '/state', json={'state': 'on'}).status_code == 401
    state = api.get('/motor-states?motor_id=MOTOR-001', headers=headers).json()['items'][0]
    assert state['state'] == 'unknown' and state['is_on'] is None
    assert state['desired_state'] is None
    assert api.get('/motor-states?state=on', headers=headers).json()['total'] == 0


def test_hardware_command_then_device_confirmation(api):
    headers = auth(api)
    motor = api.post('/motors', json={**motor_body(), 'source': 'hardware'}, headers=headers).json()
    endpoint = '/motors/' + motor['id'] + '/state'
    command = api.post(endpoint, json={'state': 'on', 'reason': 'Operator request'}, headers=headers).json()
    assert command['desired_state'] == 'on' and command['state'] == 'unknown'
    assert command['command_status'] == 'pending_device'
    assert api.get('/motor-states?state=on', headers=headers).json()['total'] == 0
    acknowledgement = api.post(endpoint, json={'state': 'on', 'source': 'device', 'command_id': command['command_id']}, headers=headers)
    assert acknowledgement.status_code == 200
    assert acknowledgement.json()['state'] == 'on'
    assert acknowledgement.json()['command_status'] == 'acknowledged'
    assert acknowledgement.json()['confirmation_source'] == 'device'
    assert len(acknowledgement.json()['history']) == 2
    assert api.get('/motor-states?state=on&include_demo=false', headers=headers).json()['items'][0]['motor_id'] == motor['id']
    off = api.post(endpoint, json={'state': 'off'}, headers=headers).json()
    assert off['state'] == 'on' and off['desired_state'] == 'off'
    assert off['command_status'] == 'pending_device'
    assert api.post(endpoint, json={'state': 'on', 'source': 'device', 'command_id': command['command_id']}, headers=headers).status_code == 409
    assert api.post(endpoint, json={'state': 'on', 'source': 'device', 'command_id': off['command_id']}, headers=headers).status_code == 409
    final = api.post(endpoint, json={'state': 'off', 'source': 'device', 'command_id': off['command_id']}, headers=headers).json()
    assert final['state'] == 'off' and final['command_status'] == 'acknowledged'
    assert final['revision'] == 4
    heartbeat = api.post(endpoint, json={'state': 'off', 'source': 'device'}, headers=headers).json()
    assert len(heartbeat['history']) == 4
    assert heartbeat['state'] == 'off'


def test_demo_state_is_simulated_and_saved(api):
    headers = auth(api)
    motor = api.post('/motors', json={**motor_body(), 'source': 'demo'}, headers=headers).json()
    response = api.post('/motors/MOTOR-001/state', json={'state': 'on'}, headers=headers)
    assert response.status_code == 200
    result = response.json()
    assert result['is_on'] and result['is_simulated']
    assert result['command_status'] == 'simulated'
    assert result['history'][0]['actor'] == 'test-user'
    assert api.get('/motor-states?state=on', headers=headers).json()['total'] == 1
    assert api.get('/motor-states?include_demo=false', headers=headers).json()['total'] == 0
    saved = api.get('/motor-states?motor_id=' + motor['id'], headers=headers).json()['items'][0]
    assert saved['state'] == 'on' and len(saved['history']) == 1


def test_stale_reports_and_validation(api):
    headers = auth(api)
    motor = api.post('/motors', json={**motor_body(), 'source': 'hardware'}, headers=headers).json()
    endpoint = '/motors/' + motor['id'] + '/state'
    old_time = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    old = api.post(endpoint, json={'state': 'on', 'source': 'device', 'reported_at': old_time}, headers=headers).json()
    assert old['last_reported_state'] == 'on' and old['state'] == 'unknown' and old['stale']
    older = (datetime.now(timezone.utc) - timedelta(minutes=20)).isoformat()
    assert api.post(endpoint, json={'state': 'off', 'source': 'device', 'reported_at': older}, headers=headers).status_code == 409
    assert api.post(endpoint, json={'state': 'invalid'}, headers=headers).status_code == 422
    assert api.post(endpoint, json={'state': 'off', 'command_id': '1' * 24}, headers=headers).status_code == 422
    assert api.post(endpoint, json={'state': 'on', 'source': 'device', 'reported_at': '2099-01-01T00:00:00Z'}, headers=headers).status_code == 422
    assert api.post('/motors/unknown/state', json={'state': 'on'}, headers=headers).status_code == 404
    assert api.get('/motor-states?state=invalid', headers=headers).status_code == 422
