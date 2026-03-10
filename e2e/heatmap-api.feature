Feature: Heatmap API endpoint (GET /api/messages/heatmap)

  As a consumer of the OboApp public API
  I want to retrieve heatmap coordinate points for all finalized messages
  So that I can render a geographic heatmap of historical data

  # ─────────────────────────────────────────────
  # Happy path
  # ─────────────────────────────────────────────

  Scenario: Returns a JSON array of coordinate points for finalized messages with GeoJSON
    Given there are finalized messages with GeoJSON geometry in the database
    When I send GET "/api/messages/heatmap"
    Then the response status is 200
    And the response body has a "points" array
    And each item in "points" is an array of [latitude, longitude]

  Scenario: City-wide messages are excluded from the response
    Given there is a finalized message with "cityWide" set to true
    When I send GET "/api/messages/heatmap"
    Then the response body "points" array does not contain a centroid from that message

  Scenario: Messages without GeoJSON are excluded from the response
    Given there is a finalized message with no "geoJson" field
    When I send GET "/api/messages/heatmap"
    Then the response body "points" array does not contain a point for that message

  Scenario: Non-finalized messages are excluded from the response
    Given there is a message that has not been finalized (no "finalizedAt")
    When I send GET "/api/messages/heatmap"
    Then the response body "points" array does not contain a point for that message

  Scenario: Multi-feature GeoJSON contributes all vertices per feature
    Given there is a finalized message whose GeoJSON has a LineString with 4 vertices
    When I send GET "/api/messages/heatmap"
    Then the response body "points" array contains 4 points from that LineString

  Scenario: A Point feature contributes exactly one point
    Given there is a finalized message whose GeoJSON has a single Point feature
    When I send GET "/api/messages/heatmap"
    Then the response body "points" array contains 1 point from that message

  Scenario: A Polygon feature contributes one point per outer-ring vertex
    Given there is a finalized message whose GeoJSON has a Polygon with 5 outer-ring vertices
    When I send GET "/api/messages/heatmap"
    Then the response body "points" array contains 5 points from that Polygon

  Scenario: Returns an empty points array when there are no eligible messages
    Given the database has no finalized messages with non-city-wide GeoJSON
    When I send GET "/api/messages/heatmap"
    Then the response status is 200
    And the response body is '{"points":[]}'

  # ─────────────────────────────────────────────
  # Error handling
  # ─────────────────────────────────────────────

  Scenario: Returns 500 when the database is unavailable
    Given the database is unavailable
    When I send GET "/api/messages/heatmap"
    Then the response status is 500
    And the response body contains '{"error":"Failed to fetch heatmap data"}'
