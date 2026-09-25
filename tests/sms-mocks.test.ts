import { testClient } from "hono/testing";
import { beforeEach, describe, expect, it } from "vitest";

import configuredApp from "@/app";
import env from "@/env";
import { createTestApp } from "@/lib/create-app";
import { mockSetDlrStatus, resetMockState } from "@/routes/sms-mock";
import router from "@/routes/sms.index";

const app = createTestApp(router);
const client = testClient(app) as any;

beforeEach(() => {
  resetMockState();
});

const SEND = {
  msg: "mock test message",
  numbers: "+256700990001",
  dlr_url: "https://example.com/dlr",
  category: "promotional",
};

describe("blasta SMS mock responses", () => {
  it("returns the getToken mock payload", async () => {
    const response = await client.v3.api.get_token.$post({
      json: {
        username: env.BLASTA_USERNAME,
        password: env.BLASTA_PASSWORD,
      },
    });

    expect(response.status).toBe(201);
    const data = await response.json() as Record<string, unknown>;
    expect(data).toMatchObject({
      username: env.BLASTA_USERNAME,
      status_code: "201",
    });
    expect(String(data.access_token)).toHaveLength(7);
  });

  it("returns the sendSms mock payload", async () => {
    const response = await client.v3.api.send_sms.$post({ header: {}, json: SEND });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      msg_id: expect.stringMatching(/^[0-9A-F]{8}$/),
      status_code: "201",
      description: "Message accepted",
    });
  });

  it("returns 400 with the sendSms failure shape on invalid body", async () => {
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
    expect(await response.json()).toEqual({
      msg_id: "",
      status_code: "400",
      description: "Invalid message format",
    });
  });

  it("returns the getDlr mock payload across the message lifecycle", async () => {
    const send = await client.v3.api.send_sms.$post({ header: {}, json: SEND });
    const { msg_id } = await send.json() as unknown as { msg_id: string };

    const pending = await client.v3.api.dlr.$post({ header: {}, json: { msgId: msg_id } });
    expect(pending.status).toBe(200);
    expect(await pending.json()).toMatchObject({
      msg_id,
      status: "pending",
      status_code: "200",
      description: "Delivery pending",
    });

    await mockSetDlrStatus(msg_id, "delivered");

    const delivered = await client.v3.api.dlr.$post({ header: {}, json: { msgId: msg_id } });
    expect(delivered.status).toBe(200);
    expect(await delivered.json()).toMatchObject({
      msg_id,
      status: "delivered",
      status_code: "200",
      description: "Delivered",
    });
  });

  it("returns 404 for a msgId that was never sent", async () => {
    const response = await client.v3.api.dlr.$post({ header: {}, json: { msgId: "mock-msg-999" } });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: "Not Found" });
  });

  it("returns submitted_at in east african time", async () => {
    const send = await client.v3.api.send_sms.$post({ header: {}, json: SEND });
    const { msg_id } = await send.json() as unknown as { msg_id: string };

    const dlr = await client.v3.api.dlr.$post({ header: {}, json: { msgId: msg_id } });
    const body = await dlr.json() as unknown as { submitted_at: string };
    expect(body.submitted_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}$/);
  });

  it("accepts urlencoded token credentials", async () => {
    const response = await app.request("/v3/api/get_token/", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        username: env.BLASTA_USERNAME,
        password: env.BLASTA_PASSWORD,
      }),
    });

    expect(response.status).toBe(201);
  });

  it("accepts multipart token credentials", async () => {
    const body = new FormData();
    body.set("username", env.BLASTA_USERNAME);
    body.set("password", env.BLASTA_PASSWORD);

    const response = await app.request("/v3/api/get_token/", {
      method: "POST",
      body,
    });

    expect(response.status).toBe(201);
  });

  it("publishes the three request media types and required bodies", async () => {
    const response = await configuredApp.request("/doc");
    expect(response.status).toBe(200);

    const document = await response.json() as {
      paths: Record<string, {
        post?: {
          requestBody?: {
            required?: boolean;
            content: Record<string, unknown>;
          };
          parameters?: Array<{
            name?: string;
            required?: boolean;
          }>;
        };
      }>;
    };

    for (const path of ["/v3/api/get_token/", "/v3/api/send_sms/", "/v3/api/dlr/"]) {
      const requestBody = document.paths[path]?.post?.requestBody;
      expect(requestBody?.required).toBe(true);
      expect(Object.keys(requestBody?.content ?? {})).toEqual(expect.arrayContaining([
        "application/json",
        "application/x-www-form-urlencoded",
        "multipart/form-data",
      ]));
    }

    for (const path of ["/v3/api/send_sms/", "/v3/api/dlr/"]) {
      const authParameter = document.paths[path]?.post?.parameters?.find(parameter => parameter.name === "authToken");
      expect(authParameter?.required).toBe(true);
    }
  });
});
