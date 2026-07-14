import { expect, test } from "@playwright/test";

const testOrigin = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001";

test("720p camera stays smooth through browser WebRTC encoding", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["camera"], {
    origin: testOrigin,
  });
  await page.goto("/sign-in");

  const result = await page.evaluate(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        width: 1280,
        height: 720,
        frameRate: 30,
      },
    });
    const sender = new RTCPeerConnection();
    const receiver = new RTCPeerConnection();
    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    document.body.append(video);

    sender.onicecandidate = ({ candidate }) => {
      if (candidate) void receiver.addIceCandidate(candidate);
    };
    receiver.onicecandidate = ({ candidate }) => {
      if (candidate) void sender.addIceCandidate(candidate);
    };
    receiver.ontrack = ({ streams }) => {
      video.srcObject = streams[0] ?? null;
    };
    const videoSender = sender.addTrack(stream.getVideoTracks()[0], stream);
    const parameters = videoSender.getParameters();
    parameters.encodings = [{
      maxBitrate: 1_700_000,
      maxFramerate: 30,
      scaleResolutionDownBy: 1,
    }];
    parameters.degradationPreference = "maintain-resolution";
    await videoSender.setParameters(parameters);

    const offer = await sender.createOffer();
    await sender.setLocalDescription(offer);
    await receiver.setRemoteDescription(offer);
    const answer = await receiver.createAnswer();
    await receiver.setLocalDescription(answer);
    await sender.setRemoteDescription(answer);

    await new Promise<void>((resolve) => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        resolve();
        return;
      }
      video.addEventListener("loadeddata", () => resolve(), { once: true });
    });
    const hdDeadline = performance.now() + 10_000;
    while (video.videoHeight < 720 && performance.now() < hdDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const framesPerSecond = await new Promise<number>((resolve) => {
      const startedAt = performance.now();
      let frames = 0;
      let settled = false;
      const finish = (now: number) => {
        if (settled) return;
        settled = true;
        resolve((frames * 1_000) / (now - startedAt));
      };
      const fallback = window.setTimeout(() => finish(performance.now()), 5_000);
      const sample = (now: number) => {
        frames += 1;
        const elapsed = now - startedAt;
        if (elapsed >= 3_000) {
          window.clearTimeout(fallback);
          finish(now);
          return;
        }
        video.requestVideoFrameCallback(sample);
      };
      video.requestVideoFrameCallback(sample);
    });

    const sourceSettings = stream.getVideoTracks()[0].getSettings();
    const dimensions = {
      width: video.videoWidth,
      height: video.videoHeight,
    };
    stream.getTracks().forEach((track) => track.stop());
    if (video.srcObject instanceof MediaStream) {
      video.srcObject.getTracks().forEach((track) => track.stop());
    }
    video.srcObject = null;
    sender.onicecandidate = null;
    receiver.onicecandidate = null;
    receiver.ontrack = null;
    sender.close();
    receiver.close();
    video.remove();

    return {
      ...dimensions,
      framesPerSecond,
      sourceWidth: sourceSettings.width ?? 0,
      sourceHeight: sourceSettings.height ?? 0,
      sourceFramesPerSecond: sourceSettings.frameRate ?? 0,
    };
  });

  expect(result.sourceWidth).toBeGreaterThanOrEqual(1280);
  expect(result.sourceHeight).toBeGreaterThanOrEqual(720);
  expect(result.width).toBeGreaterThanOrEqual(1280);
  expect(result.height).toBeGreaterThanOrEqual(720);
  expect(result.framesPerSecond).toBeGreaterThanOrEqual(
    result.sourceFramesPerSecond * 0.85
  );
});
