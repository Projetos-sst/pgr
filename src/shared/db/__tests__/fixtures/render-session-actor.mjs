import { createRequire } from "node:module";
import { PassThrough } from "node:stream";
import { createElement } from "react";

import { currentActor, rememberActor } from "../../session-actor.ts";

const require = createRequire(import.meta.url);
const {
  renderToPipeableStream,
} = require("next/dist/compiled/react-server-dom-webpack/server.node");

const seen = {};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function guard(user) {
  await pause(5);
  rememberActor(user);
}

async function repository(label) {
  await pause(3);
  seen[label] = currentActor();
}

async function Layout({ user, children }) {
  await guard(user);
  return createElement("div", null, children);
}

async function Page({ user }) {
  await guard(user);
  await repository(`page:${user}`);
  return createElement(Nested, { user });
}

async function Nested({ user }) {
  await repository(`nested:${user}`);
  return createElement("span", null, user);
}

function render(user) {
  return new Promise((resolve) => {
    const sink = new PassThrough();
    sink.on("data", () => undefined);
    sink.on("end", resolve);
    const tree = createElement(Layout, { user }, createElement(Page, { user }));
    renderToPipeableStream(tree, {}).pipe(sink);
  });
}

await Promise.all([render("alice"), render("bob")]);
seen.afterRender = currentActor();
process.stdout.write(JSON.stringify(seen));
