"""Offline unit tests for the task-local toolchain installer.

Entry: read_github_token / fetch_lfs_release from the actual installer.
Contract: user's dotenv/Bearer/403 redaction requirements (2026-10-26).
Wired into the repo test command as `pnpm test:toolchain-release`.
Runs offline: fake tokens, isolated temp files, no network access.
"""
import contextlib
import importlib.util
import io
from email.message import Message
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError


SOURCE = Path(__file__).resolve().parents[1] / 'node_modules/.cindy-toolchain/install.py'
SPEC = importlib.util.spec_from_file_location('task_toolchain_installer', SOURCE)
installer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(installer)


class ReleaseChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='cindy-6963-env-test-')
        self.addCleanup(self.temp.cleanup)
        self.env_file = Path(self.temp.name) / '.env'
        self.network = patch.object(installer.urllib.request, 'urlopen').start()
        self.addCleanup(patch.stopall)
        # Every request must be explicitly mocked by a test; never use a network.
        self.network.side_effect = AssertionError('Unexpected network invocation')

    def write_env(self, text):
        self.env_file.write_bytes(text.encode('utf-8'))

    def test_dotenv_supported_forms(self):
        cases = [
            ('GITHUB_TOKEN=fake-token\n', 'fake-token'),
            (' export GITHUB_TOKEN = fake-token # comment\n', 'fake-token'),
            ('GITHUB_TOKEN="fake-token"\n', 'fake-token'),
            ("GITHUB_TOKEN='fake#token'\n", 'fake#token'),
            ('\ufeff# comment\r\nOTHER=ignored\r\nGITHUB_TOKEN=fake-token\r\n', 'fake-token'),
            ('GITHUB_TOKEN=old-fake\nGITHUB_TOKEN=new-fake\n', 'new-fake'),
        ]
        for text, expected in cases:
            with self.subTest(form=cases.index((text, expected))):
                self.write_env(text)
                self.assertEqual(installer.read_github_token(self.env_file), expected)
        self.network.assert_not_called()

    def test_missing_empty_or_malformed_token_blocks_before_network(self):
        for index, text in enumerate([
            '', 'OTHER=fake', 'GITHUB_TOKEN=', 'GITHUB_TOKEN="  "',
            'GITHUB_TOKEN="fake-private', 'GITHUB_TOKEN=fake-private extra',
            'GITHUB_TOKEN=fake-private\nGITHUB_TOKEN= # cleared',
        ]):
            with self.subTest(case=index):
                self.write_env(text)
                with self.assertRaises(SystemExit) as caught:
                    installer.fetch_lfs_release(self.env_file)
                self.assertNotIn('fake-private', str(caught.exception))
        self.network.assert_not_called()

    def test_missing_unreadable_or_invalid_encoding_file_blocks_network(self):
        with self.assertRaisesRegex(SystemExit, '文件不存在'):
            installer.fetch_lfs_release(self.env_file)
        with patch.object(Path, 'read_text', side_effect=PermissionError('fake-private-path')):
            with self.assertRaises(SystemExit) as caught:
                installer.fetch_lfs_release(self.env_file)
            self.assertNotIn('fake-private-path', str(caught.exception))
        self.env_file.write_bytes(b'\xff\xfe')
        with self.assertRaisesRegex(SystemExit, '编码'):
            installer.fetch_lfs_release(self.env_file)
        self.network.assert_not_called()

    def test_success_sends_bearer_without_logging_token(self):
        self.write_env('GITHUB_TOKEN=fake-private-token')
        self.network.side_effect = None
        self.network.return_value = io.BytesIO(b'{"tag_name":"v3.7.1","assets":[]}')
        output = io.StringIO()
        with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
            result = installer.fetch_lfs_release(self.env_file)
        self.assertEqual(result['tag_name'], 'v3.7.1')
        self.assertEqual(self.network.call_args.args[0].get_header('Authorization'), 'Bearer fake-private-token')
        self.assertEqual(output.getvalue(), '')
        self.assertEqual(self.network.call_count, 1)

    def assert_403(self, headers, expected):
        self.write_env('GITHUB_TOKEN=fake-private-token')
        self.network.side_effect = HTTPError(
            'https://api.github.com/', 403, 'fake-private-reason', headers,
            io.BytesIO(b'fake-private-body'),
        )
        output = io.StringIO()
        with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
            with self.assertRaises(SystemExit) as caught:
                installer.fetch_lfs_release(self.env_file)
        self.assertEqual(caught.exception.code, 1)
        self.assertEqual(output.getvalue(), expected)
        self.assertNotIn('fake-private', output.getvalue())
        self.assertEqual(self.network.call_count, 1)

    def test_403_prints_only_five_allowed_response_headers(self):
        headers = Message()
        headers['X-RateLimit-Limit'] = '5000'
        headers['X-RateLimit-Remaining'] = '0'
        headers['X-RateLimit-Reset'] = '1793000000'
        headers['X-RateLimit-Resource'] = 'core'
        headers['Retry-After'] = '60'
        headers['Authorization'] = 'Bearer fake-private-header'
        headers['X-Other'] = 'fake-private-extra'
        self.assert_403(headers,
            'x-ratelimit-limit: 5000\nx-ratelimit-remaining: 0\n'
            'x-ratelimit-reset: 1793000000\nx-ratelimit-resource: core\nretry-after: 60\n')

    def test_403_missing_headers_still_does_not_print_body_or_retry(self):
        self.assert_403(None,
            'x-ratelimit-limit: \nx-ratelimit-remaining: \nx-ratelimit-reset: \n'
            'x-ratelimit-resource: \nretry-after: \n')

    def test_other_failures_do_not_echo_private_exception_text(self):
        self.write_env('GITHUB_TOKEN=fake-private-token')
        for error in [HTTPError('https://api.github.com/', 401, 'fake-private-reason', {}, None),
                      URLError('fake-private-network'), ValueError('fake-private-json')]:
            self.network.reset_mock()
            self.network.side_effect = error
            with self.subTest(kind=type(error).__name__):
                with self.assertRaises(SystemExit) as caught:
                    installer.fetch_lfs_release(self.env_file)
                self.assertNotIn('fake-private', str(caught.exception))
                self.assertEqual(self.network.call_count, 1)


if __name__ == '__main__':
    unittest.main(verbosity=2)
