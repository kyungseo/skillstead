"""Python release normalization and JavaScript runtime canonicalization must stay identical."""

from __future__ import annotations

import json
import shutil
import subprocess
import unittest
from pathlib import Path

from tools.skillstead_validate.normalize import normalize_skill_md


REPO = Path(__file__).resolve().parent.parent
NODE = shutil.which("node")
LIB = (REPO / "skills/svg-infographic/scripts/preflight-lib.mjs").as_uri()


@unittest.skipIf(NODE is None, "node is required for Python/JavaScript canonicalization parity")
class RuntimeCanonicalizationParity(unittest.TestCase):
    def js_normalize(self, text: str) -> str:
        script = (
            f'import {{ normalizeSkillMetadataVersion }} from {json.dumps(LIB)};'
            'let s=""; for await (const c of process.stdin) s += c;'
            'process.stdout.write(normalizeSkillMetadataVersion(s));'
        )
        result = subprocess.run(
            [NODE, "--input-type=module", "--eval", script], input=text.encode("utf-8"),
            capture_output=True, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8", errors="replace"))
        return result.stdout.decode("utf-8")

    def test_python_and_javascript_normalize_the_same_bytes(self) -> None:
        cases = (
            "---\nname: x\nmetadata:\n  version: 1.2.3\n---\nbody\n",
            "---\r\nname: x\r\nmetadata:\r\n  version: 1.2.3\r\n---\r\nbody\r\n",
            "---\nmetadata:\n  version: 1.2.3\nother:\n  version: keep\n---\nversion: body\n",
            "---\nname: x\n---\nmetadata:\n  version: body\n",
        )
        for source in cases:
            with self.subTest(source=source.encode()):
                self.assertEqual(self.js_normalize(source), normalize_skill_md(source))


if __name__ == "__main__":
    unittest.main()
