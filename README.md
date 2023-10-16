# NoRake - Online Poker Platform

## Servers

### Game Server

This server serves game play pages, creates and shows tables and manages users.

**How to Install**

- Run *install.cmd* in the project directory.
- Run *run.cmd* in the project directory.

### Table Manager

This server is a API server which handles creating and deleting table servers

**How to Install**

- Run *install.cmd* in the project directory.
- Run *run.cmd* in the project directory.

### Table Server

This server handles poker game logic for single table. This server is launched by *Table Manager*.

**How to Install**

- Run *install.cmd* in the project directory.
- Run *build.cmd* in the project directory.

## Client

This client has made by Unity WebGL.

**How to Build**

When you build the client in Unity, you must select build directory as /GameServer/public/game.
