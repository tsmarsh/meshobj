import express, {Application, Express} from "express";
import {init} from "./index";
import {Auth} from "@meshql/auth";
import {It, Mock} from "moq.ts";
import {Repo} from "./src/repo";
import Log4js from "log4js";


const port = 40200;

const auth: Auth = new Mock<Auth>()
    .setup(async i => i.getAuthToken(It.IsAny())).returnsAsync("TOKEN")
    .setup(async i => i.secureData(It.IsAny(), It.IsAny())).returnsAsync({"id": "666", "payload": { "name": "chuck", "eggs": 6 }})
    .setup(async i => i.isAuthorized(It.IsAny(), It.IsAny())).returnsAsync(true).object()

const repo: Repo = new Mock<Repo>()
    .setup(async i => i.create(It.IsAny())).returnsAsync({"id": "666", "payload": { "name": "chuck", "eggs": 6 }})
    .setup(async i => i.list(It.IsAny())).returnsAsync([{"id": "666", "payload": { "name": "chuck", "eggs": 6 }}])
    .setup(async i => i.read(It.IsAny(), It.IsAny())).returnsAsync({"id": "666", "payload": { "name": "chuck", "eggs": 6 }}).object();

Log4js.configure({
    appenders: {
        out: {
            type: "stdout",
        },
    },
    categories: {
        default: {appenders: ["out"], level: "trace"},
    },
});

function listRoutes(app: Application) {
    const routes: string[] = [];

    app._router.stack.forEach((middleware: any) => {
        if (middleware.route) {
            // Route middleware
            routes.push(`${Object.keys(middleware.route.methods).join(',').toUpperCase()} ${middleware.route.path}`);
        } else if (middleware.name === "router") {
            // Router middleware
            middleware.handle.stack.forEach((handler: any) => {
                if (handler.route) {
                    routes.push(`${Object.keys(handler.route.methods).join(',').toUpperCase()} ${handler.route.path}`);
                }
            });
        }
    });

    console.log(`${routes}`);
}

const app: Express = express();
app.use(express.json())
let application = init(app, auth, repo, "/hens");
listRoutes(application);

let server = application.listen(port);