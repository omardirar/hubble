"""CrewAI orchestration for authenticated support responses."""

from __future__ import annotations

from collections.abc import Mapping
from pathlib import Path
from typing import TYPE_CHECKING, Any, TypeVar, cast

import yaml  # type: ignore[import-untyped]
from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from collections.abc import Callable

    Agent = Any
    Crew = Any
    Process = Any
    Task = Any

    TClass = TypeVar("TClass", bound=type)

    def agent(func: Callable[..., Agent]) -> Callable[..., Agent]: ...

    def task(func: Callable[..., Task]) -> Callable[..., Task]: ...

    def crew(func: Callable[..., Crew]) -> Callable[..., Crew]: ...

    def CrewBase(cls: TClass) -> TClass: ...
else:
    from crewai import Agent, Crew, Process, Task  # type: ignore[import-untyped]
    from crewai.project import CrewBase, agent, crew, task  # type: ignore[import-untyped]


CONFIG_DIR = Path(__file__).resolve().parent


class FinalResponse(BaseModel):
    """Structured output produced by the manager task."""

    summary: str = Field(description="High-level answer for the caller.")
    actions: list[str] = Field(
        default_factory=list,
        description="Actionable next steps recommended to the organisation.",
    )


def _load_yaml(relative_path: str) -> Mapping[str, Any]:
    path = CONFIG_DIR / relative_path
    with path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    if not isinstance(data, Mapping):  # pragma: no cover - defensive
        raise ValueError(f"Invalid YAML structure at {path}")
    return cast(Mapping[str, Any], data)


@CrewBase
class AuthenticatedSupportCrew:
    """Crew coordinating manager, analyst, and marketer agents."""

    agents_config = "config/agents.yaml"
    tasks_config = "config/tasks.yaml"

    _agents_cache: Mapping[str, Mapping[str, Any]] | None = None
    _tasks_cache: Mapping[str, Mapping[str, Any]] | None = None

    def _agent_configs(self) -> Mapping[str, Mapping[str, Any]]:
        if self._agents_cache is None:
            config = self.agents_config
            if isinstance(config, Mapping):
                self._agents_cache = cast(Mapping[str, Mapping[str, Any]], config)
            else:
                self._agents_cache = cast(Mapping[str, Mapping[str, Any]], _load_yaml(config))
        return self._agents_cache

    def _task_configs(self) -> Mapping[str, Mapping[str, Any]]:
        if self._tasks_cache is None:
            config = self.tasks_config
            if isinstance(config, Mapping):
                self._tasks_cache = cast(Mapping[str, Mapping[str, Any]], config)
            else:
                self._tasks_cache = cast(Mapping[str, Mapping[str, Any]], _load_yaml(config))
        return self._tasks_cache

    @agent
    def manager(self) -> Agent:
        config = self._agent_configs()["manager"]
        return Agent(config=config, allow_delegation=True, verbose=False)

    @agent
    def analyst(self) -> Agent:
        config = self._agent_configs()["analyst"]
        return Agent(config=config, allow_delegation=False, verbose=False)

    @agent
    def marketer(self) -> Agent:
        config = self._agent_configs()["marketer"]
        return Agent(config=config, allow_delegation=False, verbose=False)

    @task
    def analyze_request(self) -> Task:
        return Task(config=self._task_configs()["analyze_request"], agent=self.analyst())

    @task
    def prepare_marketing(self) -> Task:
        return Task(config=self._task_configs()["prepare_marketing"], agent=self.marketer())

    @task
    def compose_response(self) -> Task:
        return Task(
            config=self._task_configs()["compose_response"],
            agent=self.manager(),
            context=[self.analyze_request(), self.prepare_marketing()],
            output_pydantic=FinalResponse,
        )

    @crew
    def crew(self) -> Crew:
        final_task = self.compose_response()
        context_tasks = cast(list[Any], getattr(final_task, "context", []))

        if len(context_tasks) == 2:
            analysis_task, marketing_task = context_tasks
            analysis_task = cast(Task, analysis_task)
            marketing_task = cast(Task, marketing_task)
        else:  # pragma: no cover - defensive fallback
            analysis_task = self.analyze_request()
            marketing_task = self.prepare_marketing()
            final_task = Task(
                config=self._task_configs()["compose_response"],
                agent=self.manager(),
                context=[analysis_task, marketing_task],
                output_pydantic=FinalResponse,
            )

        return Crew(
            agents=[self.manager(), self.analyst(), self.marketer()],
            tasks=[analysis_task, marketing_task, final_task],
            process=Process.sequential,
            verbose=False,
        )
