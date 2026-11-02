// Erkennt Build-Aufgaben im Projekt (npm-Skripte, Make, Cargo, Go, Maven, Gradle, CMake …).
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { BuildTask } from '../shared/types'

export async function detect(root: string): Promise<BuildTask[]> {
  const has = (f: string): boolean => existsSync(join(root, f))
  const read = (f: string): Promise<string> => readFile(join(root, f), 'utf8').catch(() => '')
  const tasks: BuildTask[] = []
  const add = (group: string, label: string, command: string): void => {
    tasks.push({ group, label, command })
  }

  // JavaScript / TypeScript
  if (has('package.json')) {
    const pm = has('pnpm-lock.yaml') ? 'pnpm' : has('yarn.lock') ? 'yarn' : has('bun.lockb') || has('bun.lock') ? 'bun' : 'npm'
    add(pm, 'Abhängigkeiten installieren', `${pm} install`)
    try {
      const scripts = (JSON.parse(await read('package.json')) as { scripts?: Record<string, string> }).scripts ?? {}
      for (const name of Object.keys(scripts)) {
        add(pm, name, pm === 'npm' || pm === 'bun' ? `${pm} run ${name}` : `${pm} ${name}`)
      }
    } catch {
      /* kaputte package.json */
    }
  }

  // Make
  const makefile = ['Makefile', 'makefile', 'GNUmakefile'].find(has)
  if (makefile) {
    const targets = new Set<string>()
    for (const line of (await read(makefile)).split('\n')) {
      const m = line.match(/^([A-Za-z0-9][A-Za-z0-9_.\-/]*)\s*:(?!=)/)
      if (m) targets.add(m[1])
    }
    if (!targets.size) add('make', 'make', 'make')
    for (const t of [...targets].slice(0, 25)) add('make', t, `make ${t}`)
  }

  // Rust
  if (has('Cargo.toml')) {
    add('cargo', 'build', 'cargo build')
    add('cargo', 'build --release', 'cargo build --release')
    add('cargo', 'test', 'cargo test')
    add('cargo', 'run', 'cargo run')
  }

  // Go
  if (has('go.mod')) {
    add('go', 'build', 'go build ./...')
    add('go', 'test', 'go test ./...')
    add('go', 'run', 'go run .')
  }

  // Java
  if (has('pom.xml')) {
    const mvn = has('mvnw') ? './mvnw' : 'mvn'
    add('maven', 'package', `${mvn} package`)
    add('maven', 'test', `${mvn} test`)
    add('maven', 'clean install', `${mvn} clean install`)
  }
  if (has('build.gradle') || has('build.gradle.kts')) {
    const gradle = has('gradlew') ? './gradlew' : 'gradle'
    add('gradle', 'build', `${gradle} build`)
    add('gradle', 'test', `${gradle} test`)
    add('gradle', 'run', `${gradle} run`)
  }

  // C / C++
  if (has('CMakeLists.txt')) {
    add('cmake', 'konfigurieren', 'cmake -S . -B build')
    add('cmake', 'build', 'cmake --build build')
    add('cmake', 'test', 'ctest --test-dir build')
  }

  // Python
  if (has('requirements.txt')) add('python', 'Abhängigkeiten installieren', 'python3 -m pip install -r requirements.txt')
  if (has('pyproject.toml')) add('python', 'Paket installieren', 'python3 -m pip install -e .')
  if (has('pyproject.toml') || has('pytest.ini') || has('tests')) add('python', 'Tests (pytest)', 'python3 -m pytest')

  // .NET
  const entries = await readdir(root).catch(() => [] as string[])
  if (entries.some((e) => e.endsWith('.sln') || e.endsWith('.csproj') || e.endsWith('.fsproj'))) {
    add('dotnet', 'build', 'dotnet build')
    add('dotnet', 'test', 'dotnet test')
    add('dotnet', 'run', 'dotnet run')
  }

  // Sonstiges
  if (has('Gemfile')) add('ruby', 'bundle install', 'bundle install')
  if (has('composer.json')) add('php', 'composer install', 'composer install')
  if (has('Dockerfile')) {
    const name = root.split('/').pop()!.toLowerCase().replace(/[^a-z0-9_.-]+/g, '-')
    add('docker', 'Image bauen', `docker build -t ${name} .`)
  }
  if (has('docker-compose.yml') || has('compose.yaml') || has('compose.yml') || has('docker-compose.yaml')) {
    add('docker', 'compose up', 'docker compose up')
  }
  return tasks
}
