import { CasbinAuth } from "../index";
import { Enforcer, newEnforcer } from "casbin";
import { Auth } from "@meshql/auth";
import { Envelope } from "@meshql/common";

jest.mock("casbin", () => ({
    newEnforcer: jest.fn(),
}));

describe("CasbinAuth", () => {
    let mockEnforcer: jest.Mocked<Enforcer>;
    let mockAuth: jest.Mocked<Auth>;

    beforeEach(() => {
        // Mock Enforcer methods
        mockEnforcer = {
            getRolesForUser: jest.fn(),
        } as unknown as jest.Mocked<Enforcer>;

        // Mock newEnforcer to return the mocked Enforcer
        (newEnforcer as jest.Mock).mockResolvedValue(mockEnforcer);

        // Mock Auth methods
        mockAuth = {
            getAuthToken: jest.fn(),
            isAuthorized: jest.fn(),
        } as jest.Mocked<Auth>;

        mockAuth.getAuthToken.mockResolvedValue(["user1"]);
        mockAuth.isAuthorized.mockResolvedValue(true);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test("should initialize CasbinAuth correctly", async () => {
        const casbinAuth = await CasbinAuth.create(["model.conf", "policy.csv"], mockAuth);

        expect(casbinAuth).toBeDefined();
        expect(casbinAuth.enforcer).toBe(mockEnforcer);
        expect(newEnforcer).toHaveBeenCalledWith("model.conf", "policy.csv");
    });

    test("should retrieve roles for a user via getAuthToken", async () => {
        mockAuth.getAuthToken.mockResolvedValueOnce(["user1"]);
        mockEnforcer.getRolesForUser.mockResolvedValueOnce(["role1", "role2"]);

        const casbinAuth = await CasbinAuth.create(["model.conf", "policy.csv"], mockAuth);

        const roles = await casbinAuth.getAuthToken({});

        expect(mockAuth.getAuthToken).toHaveBeenCalledWith({});
        expect(mockEnforcer.getRolesForUser).toHaveBeenCalledWith("user1");
        expect(roles).toEqual(["role1", "role2"]);
    });

    test("should authorize correctly when credentials match tokens", async () => {
        const casbinAuth = await CasbinAuth.create(["model.conf", "policy.csv"], mockAuth);

        const envelope: Envelope<any> = {
            payload: { pay: "load" },
            authorized_tokens: ["token1", "token2"],
        };

        const isAuthorized = await casbinAuth.isAuthorized(["token2"], envelope);

        expect(isAuthorized).toBe(true);
    });

    test("should deny authorization when credentials do not match tokens", async () => {
        const casbinAuth = await CasbinAuth.create(["model.conf", "policy.csv"], mockAuth);

        const envelope: Envelope<any> = {
            payload: { pay: "load" },
            authorized_tokens: ["token1", "token2"],
        };

        const isAuthorized = await casbinAuth.isAuthorized(["token3"], envelope);

        expect(isAuthorized).toBe(false);
    });

    test("should authorize everyone when authorized_tokens is empty", async () => {
        const casbinAuth = await CasbinAuth.create(["model.conf", "policy.csv"], mockAuth);

        const envelope: Envelope<any> = {
            payload: { pay: "load" },
            authorized_tokens: [],
        };

        const isAuthorized = await casbinAuth.isAuthorized([], envelope);

        expect(isAuthorized).toBe(true);
    });
});
