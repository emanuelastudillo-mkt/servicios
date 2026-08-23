#!/usr/bin/env python3
import subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
for tool in ['update_rates.py','update_dnrpa.py']:
    subprocess.run([sys.executable,str(ROOT/'tools'/tool)],check=True)
# update_dnrpa ya reconstruye el catálogo. Este paso garantiza consistencia si se modifica el flujo.
subprocess.run([sys.executable,str(ROOT/'tools/build_unified_catalog.py')],check=True)
