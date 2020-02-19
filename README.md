# http-sip2

A simple http wrapper for a sip2 client. Based on express and node-sip2 project (https://github.com/janosch12345/node-sip2).

The sip2 client bundles several sip2 connections into one connection and splits up incoming request to all underlying connections.

## Warning 

There is **NO** security build in this application. All routes are open to public and no authorization is done.
Please secure the routes in order to restrict access only to certain clients to prevent the drop of personal data from your patrons.
F.e. put the application behind a reverse proxy (apache or nginx running under https) and add at least a basic auth. In server js you can restrict incoming connections to certain IP addresses. 

## Installation

- Run `$ npm install` to add all dependencies.
- Rename `_config.js` to `config.js` and enter your sip2 configuration.
- Testconnections from config.js are used when node is running in development mode.

A systemd service file is included in `system/`

## Startup

  node server.js

## Routes

Not all sip requests are included as routes yet, but simple to be integrated when you are firm with the node-sip2 project.

### Items

`http://localhost:3000/sip3/itemInformation/:itemIdentifier`

### Patron

`itemType` is one of the following or `"hold","overdue","charged","fine","recall","unavailable","fee"` or left empty

`http://localhost:3000/sip3/patronInformation/:patronIdentifier/:itemType?`

### Checkout 

`http://localhost:3000/sip3/checkout/:patronIdentifier/:itemIdentifier`

### Checkin 

`http://localhost:3000/sip3/checkin/:itemIdentifier`

### Renew 

`http://localhost:3000/sip3/renew/:patronIdentifier/:itemIdentifier`

## Middleware

It is possible to add a middleware in order to bundle certain sip2 requests in order to build complex responses e.g. return a patron account including all items. 

An example called unidos is included and triggered via config.js. To enable it set `unidos : true`
