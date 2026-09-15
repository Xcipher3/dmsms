import { testClient } from "hono/testing";
import { beforeAll, describe, expect, it } from "vitest";

import { createTestApp } from "@/lib/create-app";
import router from "@/routes/sms.index";

const client = testClient(createTestApp(router));

describe("blasta routes", () => {
  beforeAll(async () => {
    console.log("Running blasta route tests");
  });

  it("post /sms/send creates an SMS", async () => {
    const response = await client.sms.send.$post({
      json: {
        msg: "Test message",
        numbers: "+256770123456",
        dlr_url: "https://example.com/dlr",
        category: "Marketing",
      },
    });
    expect(response.status).toBe(201);
  });

  it("post /sms/dlr checks delivery status", async () => {
    const response = await client.sms.dlr.$post({
      json: {
        msgId: "12345",
      },
    });
    expect(response.status).toBe(200);
  });

  it("post /sms/token generates a token", async () => {
    const response = await client.sms.token.$post({
      json: {
        username: "testuser",
        password: "testpass",
      },
    });
    expect(response.status).toBe(201);
  });

  it("get /sms/opt-outs lists opt-outs", async () => {
    const response = await client.sms["opt-outs"].$get();
    expect(response.status).toBe(200);
  });
});
