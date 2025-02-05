import express from 'express';

export function getRegisteredPaths(app: express.Application): Array<{ method: string; path: string }> {
    const routes: Array<{ method: string; path: string }> = [];

    app._router.stack.forEach((middleware: any) => {
        if (middleware.route) {
            // Routes registered directly on the app (e.g., app.get('/path'))
            const { path, methods } = middleware.route;
            Object.keys(methods).forEach((method) => {
                routes.push({ method: method.toUpperCase(), path });
            });
        } else if (middleware.name === 'router') {
            // Routes registered on a router (e.g., router.get('/path'))
            middleware.handle.stack.forEach((handler: any) => {
                const { route } = handler;
                if (route) {
                    const { path, methods } = route;
                    Object.keys(methods).forEach((method) => {
                        routes.push({ method: method.toUpperCase(), path });
                    });
                }
            });
        }
    });

    return routes;
}
