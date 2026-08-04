import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
after(() => server.close());
const { normalizeSolarVisualTimeline: normalize, sampleSolarVisualPoints: sample, formatSolarPointTime } =
  await server.ssrLoadModule("/src/client/platform/solarVisualTimeline.ts");
const point = (id, time, size) => ({ id, time, size, glowIntensity: size, glowSize: size, color: "#ffffff" });

test("migrates existing sizes, colors and halos without changing the daytime plateau", () => {
  const timeline = normalize({
    solarPathSunriseTime: 4, solarPathSunsetTime: 20,
    solarVisualSunriseSize: 1.1, solarVisualNoonSize: 2, solarVisualSunsetSize: 3,
    solarVisualSunriseColor: "#ff9933", solarVisualMoonSize: 1.4, solarVisualMoonGlowIntensity: 1.7
  });
  assert.equal(sample(timeline.sun, 4).size, 1.1);
  assert.equal(sample(timeline.sun, 12).size, 2);
  assert.equal(sample(timeline.sun, 14).size, 2);
  assert.equal(sample(timeline.sun, 20).size, 3);
  assert.equal(sample(timeline.sun, 4).color, "#ff9933");
  assert.equal(sample(timeline.moon, 23).size, 1.4);
  assert.equal(sample(timeline.moon, 0).glowIntensity, 1.7);
});

test("interpolates all appearance values continuously through midnight", () => {
  const timeline = normalize({ solarVisualTimeline: { sun: [point("late", 22, 1), point("early", 2, 3)] } });
  for (const key of ["size", "glowIntensity", "glowSize"]) {
    assert.equal(sample(timeline.sun, 0)[key], 2);
    assert.ok(Math.abs(sample(timeline.sun, 23.99999)[key] - sample(timeline.sun, 0.00001)[key]) < 0.0001);
    assert.equal(sample(timeline.sun, 2)[key], 3);
    assert.ok(Math.abs(sample(timeline.sun, 1.99999)[key] - sample(timeline.sun, 2.00001)[key]) < 0.0001);
  }
});

test("a single point stays constant for the entire 24 hour cycle", () => {
  const timeline = normalize({ solarVisualTimeline: { moon: [point("only", 5, 1.25)] } });
  for (const hour of [0, 5, 12, 23.99, 24]) assert.equal(sample(timeline.moon, hour).size, 1.25);
});

test("round trips arbitrary independent solar and lunar points", () => {
  const source = { solarVisualTimeline: {
    sun: Array.from({ length: 48 }, (_, i) => point(`sun-${i}`, i / 2, 0.5 + i / 48)),
    moon: [point("moon-first", 1, 2), point("moon-second", 23, 3)]
  } };
  const timeline = normalize(source);
  assert.deepEqual(normalize(JSON.parse(JSON.stringify({ solarVisualTimeline: timeline }))), timeline);
  timeline.sun[0].size = 3;
  assert.equal(timeline.moon[0].size, 2);
  assert.equal(source.solarVisualTimeline.sun[0].size, 0.5);
});

test("normalizes duplicate midnight points, invalid values and minute precision", () => {
  const timeline = normalize({ solarVisualTimeline: {
    sun: [point("a", 24, 1), point("a", 0, 2), { id: "bad", time: 6, size: NaN, glowIntensity: 99, glowSize: 0, color: "invalid" }],
    moon: []
  } });
  assert.equal(timeline.sun.length, 2);
  assert.equal(timeline.sun[1].size, 0.72);
  assert.equal(timeline.sun[1].glowIntensity, 4);
  assert.equal(timeline.sun[1].glowSize, 0.2);
  assert.equal(timeline.sun[1].color, "#ffffff");
  assert.ok(timeline.moon.length);
  assert.equal(formatSolarPointTime(13 + 20 / 60), "13:20");
  assert.equal(formatSolarPointTime(24), "00:00");
});
