"""Requested versus reported state, with atomic revision checks and recent history."""
import os
from datetime import datetime, timezone

from bson import ObjectId
from pymongo.errors import DuplicateKeyError


class StateConflict(ValueError):
    pass


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def empty_state(motor):
    return {'motor_id': str(motor['_id']), 'desired_state': None, 'reported_state': 'unknown',
            'reported_at': None, 'requested_at': None, 'command_id': None, 'acknowledged_command_id': None,
            'confirmation_source': None, 'revision': 0, 'history': []}


def state_view(motor, document=None):
    document = document or empty_state(motor)
    simulated = motor.get('source') == 'demo'
    reported_at = document.get('reported_at')
    ttl = max(1, int(os.getenv('MOTOR_STATE_TTL_SECONDS', '300')))
    age = max(0, (datetime.now(timezone.utc) - utc(reported_at)).total_seconds()) if reported_at else None
    stale = bool(not simulated and reported_at and age > ttl)
    state = 'unknown' if stale else document.get('reported_state', 'unknown')
    command_id = document.get('command_id')
    acknowledged = bool(command_id and document.get('acknowledged_command_id') == command_id)
    status = 'not_requested' if not command_id else 'simulated' if acknowledged and simulated else 'acknowledged' if acknowledged else 'pending_device'
    return {'motor_id': str(motor['_id']), 'motor_oid': motor['motor_oid'], 'motor_name': motor['motor_name'],
            'is_simulated': simulated, 'state': state, 'is_on': True if state == 'on' else False if state == 'off' else None,
            'desired_state': document.get('desired_state'), 'last_reported_state': document.get('reported_state', 'unknown'),
            'confirmation_source': document.get('confirmation_source'), 'reported_at': reported_at,
            'requested_at': document.get('requested_at'), 'stale': stale, 'freshness_timeout_seconds': ttl,
            'command_id': command_id, 'command_status': status, 'revision': document.get('revision', 0),
            'history': document.get('history', [])}


def change_state(db, motor, state, source, actor, command_id=None, reported_at=None, reason=''):
    motor_id = str(motor['_id'])
    initial = empty_state(motor)
    try:
        db.motor_states.update_one({'motor_id': motor_id}, {'$setOnInsert': initial}, upsert=True)
    except DuplicateKeyError:
        # Another writer initialized the same motor; the unique motor_id index keeps one model.
        pass
    current = db.motor_states.find_one({'motor_id': motor_id})
    now = datetime.now(timezone.utc)
    revision = current['revision']
    event_id = str(ObjectId())
    event = {'id': event_id, 'state': state, 'source': source, 'actor': actor, 'created_at': now, 'reason': reason}
    updates = {'updated_at': now}
    if source == 'operator':
        updates.update(desired_state=state, requested_at=now, command_id=event_id)
        event['command_id'] = event_id
        if motor.get('source') == 'demo':
            updates.update(reported_state=state, reported_at=now, confirmation_source='demo', acknowledged_command_id=event_id)
            event['source'] = 'demo'
    else:
        measured = utc(reported_at) if reported_at else now
        if current.get('reported_at') and measured < utc(current['reported_at']):
            raise StateConflict('Device report is older than the last accepted report')
        if command_id is not None:
            if command_id != current.get('command_id'):
                raise StateConflict('This command is no longer current; fetch the latest desired state')
            if state != current.get('desired_state'):
                raise StateConflict('Acknowledged state must match the requested command')
            if current.get('requested_at') and measured < utc(current['requested_at']):
                raise StateConflict('Acknowledgement predates the current command')
            updates['acknowledged_command_id'] = command_id
        updates.update(reported_state=state, reported_at=measured, confirmation_source='demo' if motor.get('source') == 'demo' else 'device')
        event.update(command_id=command_id, reported_at=measured)
    mutation = {'$set': updates, '$inc': {'revision': 1}}
    meaningful = (source == 'operator' or current.get('reported_state') != state
                  or current.get('confirmation_source') != updates.get('confirmation_source')
                  or (command_id is not None and current.get('acknowledged_command_id') != command_id))
    if meaningful:
        mutation['$push'] = {'history': {'$each': [event], '$slice': -100}}
    result = db.motor_states.update_one({'motor_id': motor_id, 'revision': revision}, mutation)
    if result.matched_count != 1:
        raise StateConflict('State changed during this request; fetch the latest state and retry')
    return state_view(motor, db.motor_states.find_one({'motor_id': motor_id}))
