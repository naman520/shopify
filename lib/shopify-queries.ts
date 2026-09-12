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

/**
 * Total order count for a date range, used to tell the user when the analysed
 * set had to be capped (one cheap call instead of crawling every page).
 */
export const GET_ORDERS_COUNT_QUERY = /* GraphQL */ `
  query GetOrdersCount($query: String) {
    ordersCount(query: $query) {
      count
      precision
    }
  }
`;

/**
 * Newest orders first, so a capped result set still reflects recent activity.
 * Page size and lineItems depth are tuned for Shopify's cost budget: the API bills the
 * *requested* cost, so over-asking for line items throttles long date ranges.
 */
export const GET_ORDERS_QUERY = /* GraphQL */ `
  query GetOrders($cursor: String, $query: String) {
    orders(first: 250, after: $cursor, query: $query, sortKey: CREATED_AT, reverse: true) {
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
        lineItems(first: 10) {
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
