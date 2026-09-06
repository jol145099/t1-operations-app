from pathlib import Path

path = Path('app/new-order-v2.tsx')
text = path.read_text(encoding='utf-8')
old = """    } else if (category === '娛樂單') {\n      total = entertainmentOptions.find((option) => option.label === entertainmentOption)?.price ?? 0\n      pays = entertainmentPricing(total).pays\n"""
new = """    } else if (category === '娛樂單') {\n      const presetTotal = entertainmentOptions.find((option) => option.label === entertainmentOption)?.price ?? 0\n      total = presetTotal\n      const payBase = amountManual ? Math.max(0, Number(amount || 0)) : presetTotal\n      pays = entertainmentPricing(payBase).pays\n"""
if old not in text:
    raise SystemExit('Target entertainment pricing block not found; refusing to patch.')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
