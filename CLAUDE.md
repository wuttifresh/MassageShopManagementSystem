# Project workflow rules

## Always merge finished work into `main`

Whenever a code change task is completed in this repository (bug fix, feature,
refactor, etc.):

1. Commit the change with a clear message.
2. Push the branch to `origin`.
3. Open a pull request targeting `main`.
4. Merge the pull request into `main` immediately (squash merge), without
   waiting for manual approval — unless the user explicitly says to hold off,
   or the change is a draft/experiment the user asked to keep separate.

This applies every time, not just when the user asks for a PR explicitly.
