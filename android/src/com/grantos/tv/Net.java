package com.grantos.tv;

/** Address checks shared by the bridge and asset server. */
final class Net {
    private Net() {}

    /** localhost and RFC 1918 / link-local IPv4 literals. Other hostnames are not private. */
    static boolean isPrivateHost(String host) {
        if (host == null) return false;
        if ("localhost".equals(host)) return true;
        String[] p = host.split("\\.");
        if (p.length != 4) return false;
        int[] n = new int[4];
        try {
            for (int i = 0; i < 4; i++) {
                n[i] = Integer.parseInt(p[i]);
                if (n[i] < 0 || n[i] > 255) return false;
            }
        } catch (NumberFormatException e) {
            return false;
        }
        return n[0] == 10 || n[0] == 127 || (n[0] == 172 && n[1] >= 16 && n[1] <= 31) || (n[0] == 192 && n[1] == 168) || (n[0] == 169 && n[1] == 254);
    }
}
