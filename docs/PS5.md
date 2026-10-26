# PS5 setup

GrantOS's PS5 tile does three things, each reported on screen:

1. **Check** — asks the PS5 on your network whether it's on or in Rest Mode (UDP 9302).
2. **Wake** — if it's in Rest Mode and you've added a Remote Play credential, sends the wake signal and waits.
3. **Switch input** — tells the Roku TV to show the PS5's HDMI input (Roku ECP).

## On the PS5 (once)

- *Settings → System → Power Saving → Features Available in Rest Mode*
  - **Stay Connected to the Internet**: On
  - **Enable Turning On PS5 from Network**: On
- *Settings → System → HDMI*
  - **Enable HDMI Device Link**: On
  - **Enable One-Touch Play**: On (PS5 turns the TV on and switches to itself when you press the PS button)
- *Settings → Network → Connection Status → View Connection Status*: note the **IP address**. Reserve it
  in your router (DHCP reservation) so it doesn't change.
- Use **Rest Mode** (not Turn Off). A fully-off PS5 can only be started with its power button or the PS button.

## In GrantOS

*Settings → PlayStation 5*: set **PS5 is on HDMI** (the number printed by the TV port), the **PS5 IP address**,
then *Check PS5 now*. With the PS5 in Rest Mode you should see "in Rest Mode".

## Optional: Remote Play credential (for network wake)

Without a credential, GrantOS can't wake the PS5 itself. It still switches the input, and if HDMI Device Link
wakes the PS5 on your TV, that's enough. Try that first.

To get a credential for free, register once with **pyremoteplay** (open source, GPL-3.0; not part of GrantOS,
and **not yet tested with your console**). On a computer on the same network, with Python 3:

```sh
python3 -m pip install pyremoteplay
# The PS5 must be ON (not Rest Mode) for registration.
pyremoteplay <ps5-ip> --register
```

It asks you to sign in to PSN in a browser and paste back the URL, then for a PIN: on the PS5 go to
*Settings → System → Remote Play → Link Device* and type the 8-digit PIN it shows.

The result is saved in `~/.pyremoteplay/.profile.json`. Find `"RegistKey"` under your console's entry and copy
its value (a string like `3561373538653962`) into GrantOS *Settings → PlayStation 5 → Remote Play credential*.
GrantOS converts it to the wake format. A plain decimal credential also works.

Keep the credential private: anyone on your network with it could wake your PS5 (it can't sign in or play).

## Troubleshooting

| Message | Fix |
|---|---|
| No answer from the PS5 | It's fully off, or the two Rest Mode network options are off, or the IP changed. |
| Wake signal sent, but the PS5 hasn't reported "on" | The credential may be wrong (re-register), or the PS5 is updating. |
| TV refused the command (HTTP 403) | Roku TV: *Settings → System → Advanced system settings → Control by mobile apps → Network access → Enabled*. |
| TV did not answer | Check the Roku TV IP in *Settings → TV & HDMI*; the TV and Fire Stick must be on the same network. |
