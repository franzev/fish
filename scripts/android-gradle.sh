#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -z "${JAVA_HOME:-}" || ! -x "${JAVA_HOME}/bin/java" ]]; then
  for candidate in \
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
    "${HOME}/android-studio/jbr" \
    "/opt/android-studio/jbr"; do
    if [[ -x "${candidate}/bin/java" ]]; then
      export JAVA_HOME="${candidate}"
      break
    fi
  done
fi

if [[ -z "${JAVA_HOME:-}" || ! -x "${JAVA_HOME}/bin/java" ]]; then
  echo "Android build requires JDK 17 or newer. Set JAVA_HOME or install Android Studio." >&2
  exit 1
fi

if [[ -z "${ANDROID_HOME:-}" && -d "${HOME}/Library/Android/sdk" ]]; then
  export ANDROID_HOME="${HOME}/Library/Android/sdk"
elif [[ -z "${ANDROID_HOME:-}" && -d "${HOME}/Android/Sdk" ]]; then
  export ANDROID_HOME="${HOME}/Android/Sdk"
fi

exec "${ROOT_DIR}/apps/android/gradlew" -p "${ROOT_DIR}/apps/android" "$@"
