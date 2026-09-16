import { testClient } from "hono/testing";
import { describe, expect, it } from "vitest";

import { createTestApp } from "@/lib/create-app";
import router from "@/routes/sms.index";

const client = testClient(createTestApp(router));

describe("blasta SMS API - End-to-End Tests", () => {
  describe("send SMS", () => {
    it("should return success response with mock data", async () => {
      const response = await client.sms.send.$post({
        json: {
          msg: "Test message",
          numbers: "+1234567890",
          dlr_url: "https://example.com/dlr",
          category: "promotional",
        },
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toHaveProperty("msg_id");
      expect(data).toHaveProperty("status_code", "201");
      expect(data).toHaveProperty("description", "Message accepted");
    });

    it("should handle validation errors", async () => {
      const response = await client.sms.send.$post({
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
  });

  describe("check DLR", () => {
    it("should return delivery status for existing message", async () => {
      const response = await client.sms.dlr.$post({
        json: { msgId: "mock-msg-001" },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("status", "delivered");
      expect(data).toHaveProperty("status_code", "200");
    });

    it("should return 404 for nonexistent message", async () => {
      const response = await client.sms.dlr.$post({
        json: { msgId: "nonexistent-msg" },
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data).toHaveProperty("status_code", "404");
    });
  });

  describe("generate Token", () => {
    it("should return mock access token", async () => {
      const response = await client.sms.token.$post({
        json: {
          username: "testuser",
          password: "testpass",
        },
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toHaveProperty("access_token", "mock-token-123");
      expect(data).toHaveProperty("description", "Token generated");
    });

    it("should handle invalid credentials", async () => {
      const response = await client.sms.token.$post({
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
      const response = await client.sms["opt-out"].$post({
        json: {
          numbers: "+1234567890",
          category: "promotional",
          reason: "User requested",
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("added", 1);
      expect(data).toHaveProperty("status_code", 200);
    });

    it("should handle validation errors in opt-out", async () => {
      const response = await client.sms["opt-out"].$post({
        json: {
          numbers: "",
          category: "",
          reason: "",
        },
      });

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data).toHaveProperty("status_code", 422);
    });
  });

  describe("opt In", () => {
    it("should return success opt-in response", async () => {
      const response = await client.sms["opt-in"].$post({
        json: {
          numbers: "+1234567890",
          category: "promotional",
          reason: "User requested",
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("added", 1);
      expect(data).toHaveProperty("status_code", 200);
    });
  });

  describe("list Opt Outs", () => {
    it("should return list of opt-outs", async () => {
      const response = await client.sms["opt-outs"].$get();

      expect(response.status).toBe(200);
      const data = (await response.json()) as unknown[];
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(0);
    });
  });
});
