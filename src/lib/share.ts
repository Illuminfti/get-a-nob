export async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const type = blob.type || "image/jpeg";
  const filename = type.includes("png") ? name.replace(/\.jpe?g$/i, ".png") : name;
  return new File([blob], filename, { type });
}

export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function shareNob(dataUrl: string): Promise<"shared" | "tweeted"> {
  const file = await dataUrlToFile(dataUrl, "nob-pfp.jpg");
  const payload = {
    title: "Get a Nob",
    text: "I got a Nob. A tiny, judgmental doorman for my face.",
    files: [file],
  };
  if (typeof navigator.canShare === "function" && navigator.canShare(payload)) {
    await navigator.share(payload);
    return "shared";
  }
  downloadFile(file);
  const tweet = "https://twitter.com/intent/tweet?text=" +
    encodeURIComponent("I got a Nob. A tiny, judgmental doorman for my face.");
  window.open(tweet, "_blank", "noopener,noreferrer");
  return "tweeted";
}

export async function changeTwitterPfp(dataUrl: string): Promise<void> {
  const file = await dataUrlToFile(dataUrl, "nob-pfp.jpg");
  downloadFile(file);
  window.open("https://x.com/settings/profile", "_blank", "noopener,noreferrer");
}
