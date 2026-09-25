import { testClient } from "hono/testing";
import { beforeEach, describe, expect, it } from "vitest";

import env from "@/env";
import { createTestApp } from "@/lib/create-app";
import { mockSetDlrStatus, resetMockState } from "@/routes/sms-mock";
import router from "@/routes/sms.index";

const client = testClient(createTestApp(router)) as any;

beforeEach(() => {
  resetMockState();
});

const SEND = {
  msg: "Test message",
  numbers: "+1234567890",
  dlr_url: "https://example.com/dlr",
  category: "promotional",
};

const BLASTA_USERNAME = env.BLASTA_USERNAME;
const BLASTA_PASSWORD = env.BLASTA_PASSWORD;

describe("blasta SMS API - End-to-End Tests", () => {
  describe("generate Token", () => {
    it("should return mock access token", async () => {
      const response = await client.v3.api.get_token.$post({
        json: {
          username: BLASTA_USERNAME,
          password: BLASTA_PASSWORD,
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

  describe("send SMS", () => {
    it("should return success response with mock data", async () => {
      const response = await client.v3.api.send_sms.$post({ header: {}, json: SEND });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toHaveProperty("msg_id", expect.stringMatching(/^[0-9A-F]{8}$/));
      expect(data).toHaveProperty("status_code", "201");
      expect(data).toHaveProperty("description", "Message accepted");
    });

    it("should handle validation errors", async () => {
      const response = await client.v3.api.send_sms.$post({
        header: {},
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
    it("should return delivery status for an existing message", async () => {
      const sendRes = await client.v3.api.send_sms.$post({ header: {}, json: SEND });
      const { msg_id } = await sendRes.json() as unknown as { msg_id: string };

      const pending = await client.v3.api.dlr.$post({ header: {}, json: { msgId: msg_id } });
      expect(pending.status).toBe(200);
      expect(await pending.json()).toHaveProperty("status", "pending");

      await mockSetDlrStatus(msg_id, "delivered");

      const delivered = await client.v3.api.dlr.$post({ header: {}, json: { msgId: msg_id } });
      expect(delivered.status).toBe(200);
      expect(await delivered.json()).toHaveProperty("status", "delivered");
    });

    it("should return 404 for nonexistent message", async () => {
      const response = await client.v3.api.dlr.$post({
        header: {},
        json: { msgId: "nonexistent-msg" },
      });

      expect(response.status).toBe(404);
    });

    it("should return a Blasta-format error when no msgId or msg_id is provided", async () => {
      const response = await client.v3.api.dlr.$post({ header: {}, json: {} });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        msg_id: "",
        status_code: "400",
        description: "Provide a message ID using 'msgId' or 'msg_id'",
      });
    });

    it("should accept the snake_case msg_id field", async () => {
      const sendRes = await client.v3.api.send_sms.$post({ header: {}, json: SEND });
      const { msg_id } = await sendRes.json() as unknown as { msg_id: string };

      const delivered = await client.v3.api.dlr.$post({ header: {}, json: { msg_id } });
      expect(delivered.status).toBe(200);
      expect((await delivered.json() as unknown as { status: string }).status).toBe("pending");
    });
  });
});
