Feature: The Farm - Server Certification
  As a database plugin developer
  I want to verify my plugin works with the full MeshQL server
  So that farms, coops, and hens can be managed through GraphQL and REST APIs

  Background:
    Given a MeshQL server is running with the plugin
    And the farm data has been populated
    And I have captured the first timestamp

  Scenario: Build a server with multiple nodes
    When I query the farm graph:
      """
      {
        getById(id: "${farm_id}") {
          name
          coops {
            name
            hens {
              eggs
              name
            }
          }
        }
      }
      """
    Then the farm name should be "Emerdale"
    And there should be 3 coops

  Scenario: Answer simple queries
    When I query the hen graph:
      """
      {
        getByName(name: "duck") {
          id
          name
        }
      }
      """
    Then the result should contain a hen with name "duck"
    And the hen ID should match the saved duck ID

  Scenario: Query in both directions
    When I query the hen graph:
      """
      {
        getByCoop(id: "${coop1_id}") {
          name
          eggs
          coop {
            name
            farm {
              name
            }
          }
        }
      }
      """
    Then there should be 2 hens
    And the hens should include "chuck" and "duck"
    And the coop name should be "purple"

  Scenario: Get latest by default
    When I query the coop graph:
      """
      {
        getById(id: "${coop1_id}") {
          id
          name
        }
      }
      """
    Then the coop ID should match coop1
    And the coop name should be "purple"

  Scenario: Get closest to the timestamp when specified
    When I query the coop graph at the first timestamp:
      """
      {
        getById(id: "${coop1_id}", at: ${first_stamp}) {
          name
        }
      }
      """
    Then the coop name should be "red"

  Scenario: Obey the timestamps
    When I query the farm graph at the first timestamp:
      """
      {
        getById(id: "${farm_id}", at: ${first_stamp}) {
          coops {
            name
          }
        }
      }
      """
    Then the coops should not include "purple"

  Scenario: Pass timestamps to next layer
    When I query the farm graph at the current timestamp:
      """
      {
        getById(id: "${farm_id}", at: ${now}) {
          coops {
            name
          }
        }
      }
      """
    Then the coops should include "purple"
