import assert from "node:assert/strict";
import test from "node:test";
import { viewingOptionLabels, viewingOptions } from "./viewing";

test("maps the user's paid streaming services", () => {
  assert.deepEqual(
    viewingOptionLabels(["Disney+", "Paramount Plus", "Amazon Prime Video", "Netflix"]),
    ["Disney+ Premium", "Paramount+", "Prime Video", "Netflix"],
  );
});

test("maps ESPN channels to Disney+ Premium in Uruguay", () => {
  assert.deepEqual(viewingOptionLabels(["ESPN", "ESPN2"]), ["Disney+ Premium"]);
  assert.match(viewingOptions(["ESPN2"])[0]?.detail ?? "", /Premium plan in Uruguay/);
});

test("only marks DAZN when free access is explicit", () => {
  assert.deepEqual(viewingOptionLabels(["DAZN"]), []);
  assert.deepEqual(viewingOptionLabels(["DAZN Freemium"]), ["DAZN Free"]);
  assert.deepEqual(viewingOptionLabels(["DAZN Gratis"]), ["DAZN Free"]);
});

test("accepts free YouTube but not paid YouTube products", () => {
  assert.deepEqual(viewingOptionLabels(["YouTube"]), ["YouTube Free"]);
  assert.deepEqual(viewingOptionLabels(["YouTube TV", "YouTube Premium"]), []);
});

test("deduplicates aliases reported by a provider", () => {
  assert.deepEqual(
    viewingOptionLabels(["Paramount+", "Paramount Plus", "Prime Video", "Amazon Prime Video"]),
    ["Paramount+", "Prime Video"],
  );
});
