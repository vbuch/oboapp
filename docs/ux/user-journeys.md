# User Journeys

These journeys describe the three-tab home views in [PR #44](https://github.com/vbuch/oboapp/pull/44).
The [home-view design](home-view-design.md) defines labels, house states, and recovery.

## Journey Index

| Journey | Detail |
| --- | --- |
| Notification enrollment, guest use, and login | [Onboarding graph](../features/onboarding-flow.md#state-machine-diagram) |
| Create and manage saved zones | [Zone creation flow](../features/multi-zone-support.md#zone-creation-flow) |
| Choose a view or save it as home | Below; same behavior on desktop and mobile |

## Open the App

An explicit link takes priority. Otherwise load the saved home, defaulting to
**Всички** for a new user. Location failure keeps Nearby selected with its inline
recovery action. A saved zones home with no zones opens the creation empty state.

```mermaid
flowchart TD
    Open[Open the app] --> Link{Explicit event or coordinate link?}
    Link -->|Yes| Focus[Open the requested event or place]
    Link -->|No| Load[Wait for saved home and required user data]
    Load --> Home{Saved home}
    Home -->|All| City[Select All and show configured city overview]
    Home -->|My zones| Zones{Any saved zones?}
    Zones -->|Yes| Matches[Fit saved circles and show matching events]
    Zones -->|No| Empty[Show Add zone as the primary action]
    Home -->|Nearby| Permission{Location permission already granted?}
    Permission -->|Yes| Locate[Locate once]
    Permission -->|No| Recovery[Keep Nearby active with inline enable or retry]
    Locate --> Position{Position available inside the supported map area?}
    Position -->|Yes| Nearby[Show nearby Events]
    Position -->|No| Recovery
```

Launching the app never opens a permission dialog. Recovery uses the city camera,
hides unrelated event cards, and keeps the saved home. Background updates and
manual map movement leave the chosen camera in place.

## Browse and Save a Home

The active tab carries the house action. A filled house means that tab is home;
an outlined house can save it. Clicking a filled house keeps the current choice.
The tab and house are independent actions even though they share a visual segment.

```mermaid
flowchart TD
    Select[Select All, Nearby, or My zones] --> View[Open the tab for this visit]
    View --> House[Show the house beside the active tab]
    House --> Filled{Is this tab already home?}
    Filled -->|Yes| Keep[Show filled house and keep the choice]
    Filled -->|No| Outline[Show outlined house]
    Outline -->|Click house| Save[Save this tab as home]
    Save -->|Success| Confirm[Fill the house and confirm briefly]
    Save -->|Failure| Retry[Keep previous home and show save error]
```

Tab selection, panning, and zooming leave the saved home intact. Choosing another
tab moves the house to that tab and updates its filled or outlined state.
Settings offers the same home choices as the house action.

## Create the First Zone

Creating a zone is a goal of its own, independent of notification enrollment.
The house stays available as a secondary action while Add zone is primary.

```mermaid
flowchart TD
    Enter[Select My zones] --> Ready[Wait for saved zones]
    Ready --> HasZones{Any saved zones?}
    HasZones -->|Yes| View[Fit zones and show matching events]
    HasZones -->|No| Create[Show Add zone as the primary action]
    Create --> Place[Place and save the first zone]
    Place -->|Cancel| Create
    Place -->|Save fails: retain input and retry| Place
    Place -->|Saved| View
    View --> Optional[Optional: save My zones with its house]
```

An explicit My zones home is valid with no zones. Deleting the last zone keeps
that choice and opens its creation empty state on the next visit.

## Use Nearby and Stop Automatic Location

```mermaid
flowchart TD
    Select[Select Nearby or click inline enable or retry] --> Access[Request browser access if needed and locate once]
    Access --> Result{Position available inside the supported map area?}
    Result -->|Yes| View[Show nearby Events and allow free map movement]
    Result -->|No| Recovery[Keep Nearby active with inline retry and city fallback camera]
    View --> Save[Optional: save Nearby with its house]
    Save --> Later[Later visits use granted access or show inline enable]
    Leave[Select All or My zones] --> Stop[Ignore pending location results and stop tracking]
    Stop --> Home[Optional: save that tab as home to stop startup location]
```

Selecting Nearby for a visit leaves the saved home intact. Saving All or My zones
prevents automatic location on later visits even when browser permission remains
granted. Saving Nearby is allowed before access is granted; startup then waits
for an explicit enable action. Re-select Nearby or use inline refresh to relocate.

## Existing Preference Migration

An explicit new choice always wins. Preserve an existing My zones home. For other
returning users, preserve existing automatic location as Nearby; otherwise choose
All. Permission to access location and the saved home remain separate choices.
