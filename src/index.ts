import pkg from "../package.json" with { type: "json" };
import * as core from '@actions/core';
import * as exec from '@actions/exec';

interface SubmoduleDependency {
  depUser : string,
  depRepo : string,
  depPR : string,
};

function get_submodule_dependencies(text : string) : SubmoduleDependency[] {
  const submodule_dependency_pattern
    = /(requires|depends on) \[{0,1}(?<urlPrefix>https:\/\/github\.com\/){0,1}(?<depUser>[a-zA-Z0-9_-]+)\/(?<depRepo>[a-zA-Z0-9_-]+)(?:#|\/pull\/)(?<depPR>[0-9]+)\]{0,1}/ig;

  var results : SubmoduleDependency[] = [];

  // By using the global flag (g), we can search repeatedly by running `exec`
  // multiple times
  var match = submodule_dependency_pattern.exec(text);

  if (match != null && match.groups != undefined) {
    results.push({
      depUser: match.groups["depUser"],
      depRepo: match.groups["depRepo"],
      depPR: match.groups["depPR"],
    });

    match = submodule_dependency_pattern.exec(text);
  }

  return results;
}

async function run(): Promise<void> {
  try {
    //const { context } = await import("@actions/github");
    const context = {
      eventName: "pull_request",
      payload: {
        pull_request: {
          body: "Requires Trauma-Station/QuietToolbox#22"
        }
      }
    };
    if (context.eventName != "pull_request" && context.eventName != "pull_request_target") {
      core.info("Not a pull request, ignoring.");
      return;
    }

    core.startGroup("Looking for submodule dependencies")

    const prBody: string = context.payload.pull_request?.body ?? "";

    const deps = get_submodule_dependencies(prBody);

    if (deps.length > 0) {
      for (var dep of deps) {
        core.info(`Detected a submodule dependency - pull request ${dep.depPR} on ${dep.depUser}/${dep.depRepo}`);
      }
    } else {
      core.info("No submodule dependencies found");
    }

    core.endGroup();

    if (deps.length == 0) {
      return;
    }

    core.startGroup("Setting git identity");

    await exec.exec("git", ["config", "--global", "user.name", "GitHub Action Runner"]);
    await exec.exec("git", ["config", "--global", "user.email", "runneradmin@noreply.com"]);

    core.endGroup();

    core.startGroup("Update submodules")

    const mapJson = core.getInput("map");
    let map: Record<string, string> = {};
    if (mapJson.trim()) {
      map = JSON.parse(mapJson);
    }
    for (var dep of deps) {
      core.info(`map: ${map}`);
      core.info(`map.depRepo: ${map[dep.depRepo]}`);
      const path = map[dep.depRepo] ?? dep.depRepo;
      const git_options = { cwd: `./${path}` };

      await exec.exec("git", ["remote", "add", "pullfrom", `https://github.com/${dep.depUser}/${dep.depRepo}.git`], git_options);

      // Pull without changing the default commit message, and always merge
      await exec.exec("git", ["pull", "--no-edit", "--no-rebase", "pullfrom", `pull/${dep.depPR}/head`], git_options);

        core.info(`Updated submodule ${dep.depRepo} to ${dep.depUser}/${dep.depRepo}#${dep.depPR}`);
    }

    core.endGroup();
  } catch (error) {
    core.setFailed((error instanceof Error)
      ? error as Error
      : `Unknown error ${typeof(error)}: {error}`);
  }
}

run()

export default {
  external: Object.keys(pkg.dependencies)
};
