# Incidents: successful sign-ins only

- New incident generation already explicitly skips non-successful sign-ins.
- Incidents UI now permanently filters out retained historical incidents tied to failed sign-ins.
- Removed the Include/Hide Failed Logins control from the Incidents page.
- Failed sign-ins remain available in Sign-in History for troubleshooting and correlation.
- AI incident review and incident alert emails continue to run only for incidents generated from successful sign-ins.
- No SQL or environment changes required.
