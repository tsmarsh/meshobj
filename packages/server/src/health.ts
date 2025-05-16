import { Config } from './configTypes';
import { Plugin } from './plugin';

interface ServiceStatus {
    status: 'ok' | 'error';
    message?: string;
}

interface HealthStatus {
    status: 'ok' | 'error';
    services: Record<string, ServiceStatus>;
}

export async function checkServiceHealth(servicePath: string, port: number): Promise<ServiceStatus> {
    try {
        const response = await fetch(`http://localhost:${port}${servicePath}/health`);
        return await response.json();
    } catch (error: unknown) {
        return {
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

export async function checkServiceReady(servicePath: string, port: number): Promise<ServiceStatus> {
    try {
        const response = await fetch(`http://localhost:${port}${servicePath}/ready`);
        return await response.json();
    } catch (error: unknown) {
        return {
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

export async function checkAllServicesHealth(config: Config): Promise<HealthStatus> {
    const services = config.graphlettes.map(g => g.path);
    const status: HealthStatus = { status: 'ok', services: {} };

    for (const service of services) {
        status.services[service] = await checkServiceHealth(service, config.port);
    }

    return status;
}

export async function checkAllServicesReady(config: Config): Promise<HealthStatus> {
    const services = config.graphlettes.map(g => g.path);
    const status: HealthStatus = { status: 'ok', services: {} };

    for (const service of services) {
        const serviceStatus = await checkServiceReady(service, config.port);
        status.services[service] = serviceStatus;

        if (serviceStatus.status !== 'ok') {
            status.status = 'error';
        }
    }

    return status;
} 