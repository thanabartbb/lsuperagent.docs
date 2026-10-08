import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock
from app import Store, Executor, consume


class Event:
    def __init__(self, **data): self.data = data
    def to_dict(self): return self.data


class Stream:
    def __init__(self, events): self.events = events; self.closed = False
    async def __aenter__(self): return self
    async def __aexit__(self, *args): self.closed = True
    def __aiter__(self): return self.iterate()
    async def iterate(self):
        for event in self.events: yield Event(**event)


class Tests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.store = Store(Path(self.tmp.name) / 'state')
        self.create = AsyncMock()
        self.client = SimpleNamespace(beta=SimpleNamespace(agents=SimpleNamespace(
            sessions=SimpleNamespace(events=SimpleNamespace(create=self.create)))))
        self.executor = Executor(self.client, self.store, Path(self.tmp.name) / 'artifacts')

    async def test_root_completion_not_idle_or_subagent(self):
        stream = Stream([
            {'type': 'agent.session.idle', 'session': {'id': 's'}},
            {'type': 'agent.session.turn.completed', 'turn': {'subagent_id': 'child'}},
            {'type': 'agent.session.turn.failed', 'turn': {'subagent_id': None}},
        ])
        with contextlib.redirect_stdout(io.StringIO()), self.assertRaises(RuntimeError):
            await consume(stream, self.client, self.store, self.executor)
        self.assertTrue(stream.closed)
        self.assertEqual(self.store.read('session.json')['id'], 's')

    async def test_disconnect_is_not_success(self):
        with self.assertRaisesRegex(RuntimeError, 'disconnected'):
            await consume(Stream([]), self.client, self.store, self.executor)

    async def test_duplicate_tool_result_does_not_reexecute(self):
        self.executor.invoke = AsyncMock(return_value={'ok': True})
        action = {'type':'function_call','turn_id':'t','call_id':'c',
                  'name':'generate_image','arguments':{'prompt':'space'}}
        with contextlib.redirect_stdout(io.StringIO()):
            await self.executor.handle('s', action)
            await self.executor.handle('s', action)
        self.assertEqual(self.executor.invoke.await_count, 1)
        self.assertEqual(self.create.await_count, 2)
        self.assertEqual(self.create.call_args_list[0], self.create.call_args_list[1])

    async def test_unknown_function_returns_error(self):
        action = {'type':'function_call','turn_id':'t','call_id':'bad',
                  'name':'run_shell','arguments':{'command':'danger'}}
        with contextlib.redirect_stdout(io.StringIO()):
            await self.executor.handle('s', action)
        self.assertFalse(self.create.call_args.kwargs['events'][0]['success'])

    async def test_missing_prompt_returns_error(self):
        action = {'type':'function_call','turn_id':'t','call_id':'bad',
                  'name':'generate_image','arguments':{}}
        with contextlib.redirect_stdout(io.StringIO()):
            await self.executor.handle('s', action)
        self.assertFalse(self.create.call_args.kwargs['events'][0]['success'])

    async def test_reasoning_not_printed(self):
        stream = Stream([
            {'type':'agent.session.reasoning.delta','delta':'PRIVATE'},
            {'type':'agent.session.turn.completed','session_id':'s', 'turn':{'subagent_id':None}},
        ])
        buffer = io.StringIO()
        with contextlib.redirect_stdout(buffer):
            await consume(stream, self.client, self.store, self.executor)
        self.assertNotIn('PRIVATE', buffer.getvalue())


if __name__ == '__main__': unittest.main()
