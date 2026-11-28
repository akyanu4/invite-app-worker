"""Adds the Muslim invitation structure to marriage templates (safe to run again):

  Bismillah opener -> Invited by -> couple (with the azwaja verse) -> ... -> Barakallah closing

  python tools/add_muslim_scenes.py worker/templates

The new scenes reuse calm stretches of each design's own background ("bg_from"), so existing timing
is untouched. Scenes are skipped when the customer clears their lines ("skip_if_empty").
"""
import json, sys
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else 'worker/templates')
NEW_IDS = {'bismillah', 'invite', 'closing'}


def art(src, size, y, at, max_width=860, dur=30, **kw):
    return {'type': 'art', 'src': f'calligraphy/{src}.png', 'size': size, 'max_width': max_width, 'x': 540, 'y': y,
            'in': at, 'dur': dur, 'reveal': 'blur', **kw}


def text(t, font, size, y, at, max_width=860, dur=24, **kw):
    return {'text': t, 'font': font, 'size': size, 'max_width': max_width, 'x': 540, 'y': y, 'in': at, 'dur': dur, **kw}


def div(y, at):
    return {'type': 'divider', 'width': 280, 'x': 540, 'y': y, 'in': at, 'dur': 20}


for tj in sorted(ROOT.glob('*/template.json')):
    t = json.loads(tj.read_text(encoding='utf-8'))
    if t.get('category') != 'marriage':
        continue
    scenes = [s for s in t['scenes'] if s['id'] not in NEW_IDS]
    by_id = {s['id']: s for s in scenes}
    calm = by_id.get('save', scenes[-1])  # the save-the-date stretch is the calmest part of each background
    first = by_id.get('couple', scenes[0])

    bismillah = {
        'id': 'bismillah', 'start_frame': 0, 'end_frame': 180, 'bg_from': calm['start_frame'],
        'transition_in': 'cut', 'skip_if_empty': ['bismillah_line1', 'bismillah_line2'],
        'slots': [
            art('allah_medallion', 290, 640, 6, dur=34),
            art('bismillah', 140, 885, 24, max_width=900),
            div(985, 38),
            text('{bismillah_line1}', 'serif', 52, 1065, 44),
            text('{bismillah_line2}', 'serif', 52, 1135, 50),
        ]}
    invite = {
        'id': 'invite', 'start_frame': 0, 'end_frame': 210, 'bg_from': first['start_frame'],
        'transition_in': 'fade', 'skip_if_empty': ['invite_hosts'],
        'slots': [
            text('{invite_label}', 'caps', 40, 650, 12, 760),
            div(712, 20),
            text('{invite_hosts}', 'caps', 60, 820, 26, 900, reveal='blur'),
            text('{invite_line1}', 'serif', 52, 950, 40, 900),
            text('{invite_line2}', 'serif', 52, 1025, 48, 900),
        ]}
    closing = {
        'id': 'closing', 'start_frame': 0, 'end_frame': 270, 'bg_from': calm['start_frame'] + 40,
        'transition_in': 'fade', 'skip_if_empty': ['closing_line', 'compliments'],
        'slots': [
            art('barakallah', 130, 650, 10),
            text('{closing_line}', 'serif', 52, 800, 30, 900),
            div(880, 40),
            text('{compliments_label}', 'caps', 40, 965, 48, 800),
            text('{compliments}', 'script', 116, 1085, 58, 900, dur=26, reveal='blur'),
        ]}

    # the azwaja verse above the couple's names, where there is room
    couple = by_id.get('couple')
    if couple:
        couple['slots'] = [s for s in couple['slots'] if s.get('src') != 'calligraphy/azwaja.png']
        top = min(s['y'] for s in couple['slots'])
        if top - 130 >= 440:
            couple['slots'].insert(0, art('azwaja', 78, top - 120, 4, max_width=700, dur=30))
        couple['transition_in'] = 'fade'
        for s in couple['slots']:  # names sharpen into place
            if '{groom_short}' in s.get('text', '') or '{bride_short}' in s.get('text', ''):
                s['reveal'] = 'blur'

    t['scenes'] = [bismillah, invite] + scenes + [closing]
    tj.write_text(json.dumps(t, indent=2, ensure_ascii=False), encoding='utf-8')
    print('updated', tj.parent.name, [s['id'] for s in t['scenes']])
