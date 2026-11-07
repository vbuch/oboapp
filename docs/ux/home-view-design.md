# Home View and Discovery

**Status: proposed UX for review.** The current draft offers two choices in
Settings. This proposal adds contextual discovery and three distinct home choices.
See the [user journey graphs](user-journeys.md).

## Three Starting Points

| Home choice | Events shown | Map on opening |
| --- | --- | --- |
| **Моите зони** | Events affecting saved zones | Fit all saved circles |
| **Карта на София** | Normal Events view | The configured city overview |
| **Около мен** | Normal Events view | Current location, once per visit |

Use the configured locality name in the city label. New users start with the city
overview. Location requires an explicit choice. My zones remains a valid saved
choice after deleting the last zone; the next visit shows the creation empty state.

## Visible Home Control

Place a house icon with the visible label **Начален изглед** beside the view
switch on desktop and mobile. It opens the same three choices as Settings, with
the saved choice selected. The label explains the control's purpose without
depending on hover or a familiar icon.

The chooser says **С какво да се отваря приложението?** Each choice has a short
description, followed by **Запази** and **Отказ**. Saving changes the next normal
home-page visit. Confirm **Начален изглед: Моите зони. Ще се отвори следващия път.**
Keep the current view and camera in place. Switching tabs, moving the map, and
using Locate leave the saved choice intact. Explicit event and coordinate links
keep their own navigation behavior.

Settings uses the same choices and descriptions and remains a second way to
change the home view. Selecting the city overview is the clear opt-out from
automatic startup location.

## Contextual Discovery

After manual entry to My zones, show a small inline hint near the house control:

> **Започвай от „Моите зони“**
>
> Тук виждаш събитията, които засягат зоните ти. Направи този изглед начален от
> бутона с къщичка. Можеш да го смениш и от Настройки.
>
> **Направи начален** · **Не сега**

The primary action saves My zones directly and confirms success. The persistent
house control remains available after dismissal. Keep the hint in the page flow
on mobile and avoid covering the map, zones, or event cards.

Show it once per browser/device, after zones have loaded, when at least one zone
exists and My zones is not already home. Remember that it was shown so later
visits do not repeat it. Dismissal or saving closes it; a failed save keeps the
visible hint available for retry. Do not show it on automatic landing,
while placing/editing a zone, or while a modal or onboarding prompt is active.
Wait until those interactions finish.

With no zones, the primary journey is **Добави зона**. Show creation guidance
without the home pitch. After the first zone is saved and other prompts finish,
the user becomes eligible for the hint. Creating a zone is available independently
of notification enrollment.

## Location Consent and Recovery

**Locate** means show the current location for this visit. Its permission copy
must say that it leaves the saved home unchanged. Granting location access alone
does not enable automatic location on later visits.

Choosing **Около мен** explains that the app will use location on each normal
opening. Request browser permission through this explicit action. Save the choice
after a successful location result inside the supported map area. On refusal,
timeout, or an unsupported location, explain the result and keep the previous home.

On a later visit, unavailable location falls back to the city overview with a
small notice and actions to retry or change home. Keep the saved choice intact.
If permission needs to be granted again, offer an explicit enable-location action
instead of opening a permission dialog on launch. Choosing city or zones prevents
further automatic requests and ignores any pending automatic result. Browser
permission itself remains under the user's browser controls.

## Existing Users

Preserve an existing My zones choice. For other returning users, preserve existing
automatic-location behavior as **Около мен**; users without that behavior start
with the city overview. A choice made in the new UI always takes priority.

## Review and Validation

Review the control, hint, and creation empty state at phone and desktop widths.
Verify hint eligibility, dismissal, first-zone creation, storage failures, all
three return visits, location opt-out, denied/expired permission, unsupported
locations, and direct links. Avoid overlapping the hint with notification prompts.
