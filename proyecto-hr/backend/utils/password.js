const alphabet =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";

export function generateTempPassword(length = 12) {
  let password = "";

  for (let index = 0; index < length; index += 1) {
    const position = Math.floor(Math.random() * alphabet.length);
    password += alphabet[position];
  }

  return password;
}
