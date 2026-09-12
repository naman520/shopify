export const GET_PRODUCTS_QUERY = /* GraphQL */ `
  query GetProducts($cursor: String) {
    products(first: 250, after: $cursor, sortKey: TITLE) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
      }
    }
  }
`;

export const GET_ORDERS_QUERY = /* GraphQL */ `
  query GetOrders($cursor: String, $query: String) {
    orders(first: 100, after: $cursor, query: $query) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        name
        createdAt
        processedAt
        cancelledAt
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        shippingAddress {
          province
          provinceCode
          countryCodeV2
          city
          zip
        }
        customAttributes {
          key
          value
        }
        customerJourneySummary {
          firstVisit {
            source
            sourceType
            utmParameters {
              campaign
              source
              medium
              content
              term
            }
          }
          lastVisit {
            source
            sourceType
            utmParameters {
              campaign
              source
              medium
              content
              term
            }
          }
        }
        lineItems(first: 100) {
          nodes {
            title
            quantity
            originalUnitPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            discountedUnitPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            variant {
              id
              title
              product {
                id
                title
              }
            }
          }
        }
      }
    }
  }
`;
