import { createClient } from "@supabase/supabase-js";

const value = (name) =>
  process.argv
    .find((argument) => argument.startsWith(`--${name}=`))
    ?.slice(name.length + 3)
    ?.trim();

const email = value("email")?.toLowerCase();

if (process.env.SUPABASE_TARGET_ENVIRONMENT !== "staging") {
  throw new Error("Refusing to update a password outside staging.");
}

if (!email || !email.includes("@")) {
  throw new Error("Use --email=staff@example.com.");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secret = process.env.SUPABASE_SECRET_KEY?.trim();
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!url?.endsWith(".supabase.co") || !secret || !publishable) {
  throw new Error("Hosted staging Supabase environment is required.");
}

function readHidden(prompt) {
  if (!process.stdin.isTTY || !process.stdout.isTTY || !process.stdin.setRawMode) {
    throw new Error("Run this command in an interactive terminal.");
  }

  return new Promise((resolve, reject) => {
    let input = "";
    const previousRawMode = Boolean(process.stdin.isRaw);

    const cleanup = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(previousRawMode);
      process.stdin.pause();
    };

    const finish = () => {
      cleanup();
      process.stdout.write("\n");
      resolve(input);
    };

    const cancel = () => {
      cleanup();
      process.stdout.write("\n");
      reject(new Error("Password update cancelled."));
    };

    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === "\u0003") {
          cancel();
          return;
        }

        if (character === "\r" || character === "\n") {
          finish();
          return;
        }

        if (character === "\u007f" || character === "\b") {
          input = input.slice(0, -1);
          continue;
        }

        if (character >= " ") input += character;
      }
    };

    process.stdout.write(prompt);
    process.stdin.setEncoding("utf8");
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}

let password = await readHidden(
  "New unique staging password (8+ characters; never reuse a value exposed in chat): ",
);
let confirmation = await readHidden("Confirm the new password: ");

if (password.length < 8 || password.length > 256) {
  password = "";
  confirmation = "";
  throw new Error("Password must contain 8 to 256 characters. Nothing was changed.");
}

if (password !== confirmation) {
  password = "";
  confirmation = "";
  throw new Error("Passwords did not match. Nothing was changed.");
}

const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let page = 1;
let user;
while (!user) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw new Error("Unable to inspect staging Auth users.");
  user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
  if (user || data.users.length < 100) break;
  page += 1;
}

if (!user || !user.email_confirmed_at) {
  throw new Error("No matching email-confirmed staging Auth user was found.");
}

const { data: profile, error: profileError } = await admin
  .from("staff_profiles")
  .select("active,role")
  .eq("id", user.id)
  .maybeSingle();

if (
  profileError ||
  !profile?.active ||
  !["admin", "reviewer"].includes(profile.role)
) {
  throw new Error("The matching staging staff profile is unavailable or inactive.");
}

const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
  password,
});

if (updateError) throw new Error("The staging password could not be updated.");

const verifier = createClient(url, publishable, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: signInData, error: signInError } = await verifier.auth.signInWithPassword({
  email: user.email,
  password,
});

password = "";
confirmation = "";

if (signInError || signInData.user?.id !== user.id) {
  throw new Error("Password updated, but normal sign-in verification failed.");
}

const { error: signOutError } = await verifier.auth.signOut({ scope: "local" });
if (signOutError) throw new Error("Password updated, but test-session sign-out failed.");

console.log(
  `Staging ${profile.role === "admin" ? "Admin" : "Reviewer"} password updated. Email confirmation, active profile, normal sign-in, and test-session sign-out were verified.`,
);
