Feature: Historic Heatmap Page (/history)

  As a visitor to OboApp
  I want to view a heatmap of all historical messages
  So that I can understand which neighbourhoods appear most frequently in the system's data

  Background:
    Given the application is running
    And the heatmap API returns at least one point

  # ─────────────────────────────────────────────
  # Page structure
  # ─────────────────────────────────────────────

  Scenario: Page has the correct title and heading
    When I navigate to "/history"
    Then the page title is "Исторически данни | OboApp"
    And I see an h1 heading with text "Исторически данни"

  Scenario: Page has a back-link to the homepage
    When I navigate to "/history"
    Then I see a link with text "← Начало"
    And that link points to "/"

  Scenario: Clicking the back-link navigates to the homepage
    Given I am on "/history"
    When I click the "← Начало" link
    Then I am on "/"

  Scenario: Page description is visible
    When I navigate to "/history"
    Then I see text "Топлинна карта на всички финализирани съобщения"

  # ─────────────────────────────────────────────
  # Map loading
  # ─────────────────────────────────────────────

  Scenario: A loading spinner is shown while heatmap data is being fetched
    Given the heatmap API is slow to respond
    When I navigate to "/history"
    Then I see a loading indicator with text "Зареждане на данните..."

  Scenario: The map is displayed after heatmap data loads successfully
    When I navigate to "/history"
    And the heatmap data has loaded
    Then the Leaflet map container is visible
    And the loading indicator is no longer visible

  Scenario: A point-count badge is shown after the map loads
    Given the heatmap API returns 1500 coordinate points
    When I navigate to "/history"
    And the heatmap data has loaded
    Then I see a badge containing "1 500 точки от исторически данни"

  Scenario: The point-count badge is not shown when there are no points
    Given the heatmap API returns 0 points
    When I navigate to "/history"
    And the heatmap data has loaded
    Then I do not see the point-count badge

  Scenario: An error message is shown when the heatmap API fails
    Given the heatmap API returns a 500 error
    When I navigate to "/history"
    Then I see an error message "Грешка при зареждане на картата"
    And the loading indicator is no longer visible

  # ─────────────────────────────────────────────
  # Map behaviour
  # ─────────────────────────────────────────────

  Scenario: The map is initially centred on Sofia
    When I navigate to "/history"
    And the heatmap data has loaded
    Then the map centre is approximately latitude 42.6977, longitude 23.3219

  Scenario: Users cannot zoom in beyond zoom level 15
    Given I am on "/history" and the map has loaded
    When I attempt to zoom in past level 15
    Then the map zoom level does not exceed 15

  Scenario: Users cannot zoom out beyond zoom level 10
    Given I am on "/history" and the map has loaded
    When I attempt to zoom out past level 10
    Then the map zoom level does not go below 10

  # ─────────────────────────────────────────────
  # Navigation — footer links
  # ─────────────────────────────────────────────

  Scenario: The footer contains a link to the historic heatmap page
    When I navigate to "/"
    Then the footer contains a link with text "Исторически данни"
    And that link points to "/history"

  Scenario: Clicking the footer link opens the historic heatmap page
    Given I am on "/"
    When I click the footer link "Исторически данни"
    Then I am on "/history"
    And I see an h1 heading with text "Исторически данни"
