import { encrypt, decrypt } from "@/lib/crypto";
import { credentialsRepo } from "@/lib/db/repos/credentials";
import { auditRepo } from "@/lib/db/repos/audit";
import { migrate } from "@/lib/db/migrate";

migrate();

const round = decrypt(encrypt("hello-omnigrid"));
console.log("crypto roundtrip:", round === "hello-omnigrid" ? "OK" : "FAIL");

const c = credentialsRepo.create({
  label: "test-key",
  kind: "ssh_key",
  secret: "-----PRIVATE-----",
  passphrase: "pp",
});
console.log("cred public  :", c);

const r = credentialsRepo.reveal(c.id);
console.log(
  "cred reveal :",
  r?.secret === "-----PRIVATE-----" && r?.passphrase === "pp" ? "OK" : "FAIL",
);

auditRepo.log({ actor: "smoke@local", action: "test.run", node_id: null, detail: { hi: 1 } });
console.log("audit recent :", auditRepo.recent(3));

credentialsRepo.delete(c.id);
console.log("creds after delete:", credentialsRepo.list().length);
