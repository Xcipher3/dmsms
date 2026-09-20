import { testClient } from "hono/testing";
import { beforeEach, describe, expect, it } from "vitest";

import { createTestApp } from "@/lib/create-app";
import router from "@/routes/sms.index";
import { mockSetDlrStatus, resetMockState } from "@/routes/sms-mock";

const client = testClient(createTestApp(router));

beforeEach(() => {
  resetMockState();
});

async function issueToken(username = "testuser", password = "testpass") {
  const res = await client.v3.api.get_token.$post({ json: { username, password } });
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

describe("blasta SMS API - End-to-End Tests", () => {
  describe("send SMS", () => {
    it("should return success response with mock data", async () => {
      const token = await issueToken();

      const response = await client.v3.api.send_sms.$post({
        json: {
          msg: "Test message",
          numbers: "+1234567890",
          dlr_url: "https://example.com/dlr",
          category: "promotional",
        },
        header: { authToken: token },
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toHaveProperty("msg_id", "mock-msg-001");
      expect(data).toHaveProperty("status_code", "201");
      expect(data).toHaveProperty("description", "Message accepted");
    });

    it("should handle validation errors", async () => {
      const response = await client.v3.api.send_sms.$post({
        json: {
          msg: "",
          numbers: "",
          dlr_url: "",
          category: "",
        },
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty("status_code", "400");
    });

    it("should reject requests without a valid token", async () => {
      const response = await client.v3.api.send_sms.$post({
        json: {
          msg: "Test message",
          numbers: "+1234567890",
          dlr_url: "https://example.com/dlr",
          category: "promotional",
        },
      });

      expect(response.status).toBe(401);
    });
  });

  describe("check DLR", () => {
    it("should return delivery status for an existing message", async () => {
      const token = await issueToken();
      const sendRes = await client.v3.api.send_sms.$post({
        json: {
          msg: "Test message",
          numbers: "+1234567890",
          dlr_url: "https://example.com/dlr",
          category: "promotional",
        },
        header: { authToken: token },
      });
      const { msg_id } = await sendRes.json() as unknown as { msg_id: string };

      const pending = await client.v3.api.dlr.$post({ json: { msgId: msg_id }, header: { authToken: token } });
      expect(pending.status).toBe(200);
      expect(await pending.json()).toHaveProperty("status", "pending");

      mockSetDlrStatus(msg_id, "delivered");

      const delivered = await client.v3.api.dlr.$post({ json: { msgId: msg_id }, header: { authToken: token } });
      expect(delivered.status).toBe(200);
      expect(await delivered.json()).toHaveProperty("status", "delivered");
    });

    it("should return 404 for nonexistent message", async () => {
      const token = await issueToken();
      const response = await client.v3.api.dlr.$post({
        json: { msgId: "nonexistent-msg" },
        header: { authToken: token },
      });

      expect(response.status).toBe(404);
    });
  });

  describe("generate Token", () => {
    it("should return mock access token", async () => {
      const response = await client.v3.api.get_token.$post({
        json: {
          username: "testuser",
          password: "testpass",
        },
      });

      expect(response.status).toBe(201);
      const data = await response.json() as { access_token: string };
      expect(data.access_token).toHaveLength(7);
      expect(data).toHaveProperty("description", "Token generated");
    });

    it("should reject invalid credentials", async () => {
      const response = await client.v3.api.get_token.$post({
        json: {
          username: "wrong",
          password: "wrong",
        },
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toHaveProperty("status_code", "401");
    });
  });

  describe("opt Out", () => {
    it("should return success opt-out response", async () => {
      const token = await issueToken();
      const response = await client.v3.api.opt_out.$post({
        json: {
          numbers: "+1234567890",
          category: "promotional",
          reason: "User requested",
        },
        header: { authToken: token },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("added", 1);
      expect(data).toHaveProperty("status_code", 200);
    });

    it("should handle validation errors in opt-out", async () => {
      const response = await client.v3.api.opt_out.$post({
        json: {
          numbers: "",
          category: "",
          reason: "",
        },
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty("success", false);
    });
  });

  describe("opt In", () => {
    it("should return success opt-in response", async () => {
      const token = await issueToken();
      const response = await client.v3.api.opt_in.$post({
        json: {
          numbers: "+1234567890",
          category: "promotional",
          reason: "User requested",
        },
        header: { authToken: token },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("added", 1);
      expect(data).toHaveProperty("status_code", 200);
    });
  });

  describe("list Opt Outs", () => {
    it("should return list of opt-outs", async () => {
      const token = await issueToken();
      const response = await client.v3.api.opt_outs.$get({ header: { authToken: token } });

      expect(response.status).toBe(200);
      const data = (await response.json()) as unknown[];
      expect(Array.isArray(data)).toBe(true);
    });
  });
});
