#!/usr/bin/env python3
import subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
for tool in ['update_rates.py','update_dnrpa.py']:
    subprocess.run([sys.executable,str(ROOT/'tools'/tool)],check=True)
