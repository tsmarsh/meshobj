import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CasbinAuth } from "../index";
import { newEnforcer } from "casbin";
// Mock casbin module
vi.mock("casbin", () => ({
    newEnforcer: vi.fn(),
}));
describe("CasbinAuth", () => {
    let mockEnforcer;
    let mockAuth;
    beforeEach(() => {
        // Mock Enforcer methods
        mockEnforcer = {
            getRolesForUser: vi.fn(),
        };
        // Mock newEnforcer to return the mocked Enforcer
        newEnforcer.mockResolvedValue(mockEnforcer);
        // Mock Auth methods
        mockAuth = {
            getAuthToken: vi.fn(),
            isAuthorized: vi.fn(),
        };
        mockAuth.getAuthToken.mockResolvedValue(["user1"]);
        mockAuth.isAuthorized.mockResolvedValue(true);
    });
    afterEach(() => {
        vi.clearAllMocks();
    });
    it("should initialize CasbinAuth correctly", async () => {
        const casbinAuth = await CasbinAuth.create(["model.conf", "policy.csv"], mockAuth);
        expect(casbinAuth).toBeDefined();
        expect(casbinAuth.enforcer).toBe(mockEnforcer);
        expect(newEnforcer).toHaveBeenCalledWith("model.conf", "policy.csv");
    });
    it("should retrieve roles for a user via getAuthToken", async () => {
        mockAuth.getAuthToken.mockResolvedValueOnce(["user1"]);
        mockEnforcer.getRolesForUser.mockResolvedValueOnce(["role1", "role2"]);
        const casbinAuth = await CasbinAuth.create(["model.conf", "policy.csv"], mockAuth);
        const roles = await casbinAuth.getAuthToken({});
        expect(mockAuth.getAuthToken).toHaveBeenCalledWith({});
        expect(mockEnforcer.getRolesForUser).toHaveBeenCalledWith("user1");
        expect(roles).toEqual(["role1", "role2"]);
    });
    it("should authorize correctly when credentials match tokens", async () => {
        const casbinAuth = await CasbinAuth.create(["model.conf", "policy.csv"], mockAuth);
        const envelope = {
            payload: { pay: "load" },
            authorized_tokens: ["token1", "token2"],
        };
        const isAuthorized = await casbinAuth.isAuthorized(["token2"], envelope);
        expect(isAuthorized).toBe(true);
    });
    it("should deny authorization when credentials do not match tokens", async () => {
        const casbinAuth = await CasbinAuth.create(["model.conf", "policy.csv"], mockAuth);
        const envelope = {
            payload: { pay: "load" },
            authorized_tokens: ["token1", "token2"],
        };
        const isAuthorized = await casbinAuth.isAuthorized(["token3"], envelope);
        expect(isAuthorized).toBe(false);
    });
    it("should authorize everyone when authorized_tokens is empty", async () => {
        const casbinAuth = await CasbinAuth.create(["model.conf", "policy.csv"], mockAuth);
        const envelope = {
            payload: { pay: "load" },
            authorized_tokens: [],
        };
        const isAuthorized = await casbinAuth.isAuthorized([], envelope);
        expect(isAuthorized).toBe(true);
    });
});
