"""Writes template.json for the light, dark-ink designs (Ivory Jharokha, Golden Doors).
Run after tools/add_muslim_scenes.py (it copies Nikah Noor's finished layout).

  python tools/make_light_templates.py worker/templates
"""
import copy, json, sys
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else 'worker/templates')
base = json.loads((ROOT / 'nikah_noor' / 'template.json').read_text(encoding='utf-8'))
INK = {'script': [126, 30, 52], 'caps': [104, 74, 32], 'serif': [88, 58, 42], 'art': [150, 108, 40]}

designs = {
    'ivory_jharokha': dict(title='Ivory Jharokha', order=1, tags=['Nikah', 'Valima', 'Light'], music_id='romantic',
                           description='An ivory arch-shaped card with gold filigree and painted roses; petals drift as the camera slowly moves in.'),
    'golden_doors': dict(title='Golden Doors', order=2, tags=['Nikah', 'Light'], music_id='romantic',
                         description='Ornate golden jali doors open onto a softly lit marble courtyard.'),
}
for name, d in designs.items():
    t = copy.deepcopy(base)
    t.update(d)
    t.update(name=name, category='marriage', ink_colors=INK, text_reveal='blur', background='background.mp4',
             max_text_width=760 if name == 'golden_doors' else 720)
    for k in ('event_backgrounds', 'preview_events'):
        t.pop(k, None)
    if name == 'golden_doors':
        # the doors open during the first 150 frames: only the Bismillah card plays over them (its text waits
        # until they are open); every other scene uses the open courtyard after frame 150
        for sc in t['scenes']:
            if sc['id'] == 'bismillah':
                sc['bg_from'] = 0
                sc['end_frame'] = 300
                for s in sc['slots']:
                    s['in'] += 115
            else:
                sc['bg_from'] = sc.get('bg_from', sc['start_frame']) + 150
    out = ROOT / name
    out.mkdir(parents=True, exist_ok=True)
    (out / 'template.json').write_text(json.dumps(t, indent=2, ensure_ascii=False), encoding='utf-8')
    print('wrote', out / 'template.json')
