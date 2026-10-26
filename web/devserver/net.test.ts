import { isPrivateHost } from "./net";

describe("isPrivateHost", () => {
  it.each(["192.168.1.20", "10.0.0.5", "172.16.0.1", "172.31.255.255", "127.0.0.1", "localhost", "169.254.1.1"])("%s is private", (h) => expect(isPrivateHost(h)).toBe(true));
  it.each(["8.8.8.8", "172.32.0.1", "example.com", "192.168.1.300", ""])("%s is not", (h) => expect(isPrivateHost(h)).toBe(false));
});
