#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { cleanObject, flattenArraysInObject, pickBySchema } from "./util.js";
import robotsParser from "robots-parser";

// Tool definitions
const AIRBNB_SEARCH_TOOL: Tool = {
  name: "airbnb_search",
  description: "Search for Airbnb listings with various filters and pagination. Provide direct links to the user",
  inputSchema: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "Location to search for (city, state, etc.)"
      },
      placeId: {
        type: "string",
        description: "Google Maps Place ID (overrides the location parameter)"
      },
      checkin: {
        type: "string",
        description: "Check-in date (YYYY-MM-DD)"
      },
      checkout: {
        type: "string",
        description: "Check-out date (YYYY-MM-DD)"
      },
      adults: {
        type: "number",
        description: "Number of adults"
      },
      children: {
        type: "number",
        description: "Number of children"
      },
      infants: {
        type: "number",
        description: "Number of infants"
      },
      pets: {
        type: "number",
        description: "Number of pets"
      },
      minPrice: {
        type: "number",
        description: "Minimum price for the stay"
      },
      maxPrice: {
        type: "number",
        description: "Maximum price for the stay"
      },
      cursor: {
        type: "string",
        description: "Base64-encoded string used for Pagination"
      },
      ignoreRobotsText: {
        type: "boolean",
        description: "Ignore robots.txt rules for this request"
      }
    },
    required: ["location"]
  }
};

const AIRBNB_LISTING_DETAILS_TOOL: Tool = {
  name: "airbnb_listing_details",
  description: "Get detailed information about a specific Airbnb listing. Provide direct links to the user",
  inputSchema: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "The Airbnb listing ID"
      },
      checkin: {
        type: "string",
        description: "Check-in date (YYYY-MM-DD)"
      },
      checkout: {
        type: "string",
        description: "Check-out date (YYYY-MM-DD)"
      },
      adults: {
        type: "number",
        description: "Number of adults"
      },
      children: {
        type: "number",
        description: "Number of children"
      },
      infants: {
        type: "number",
        description: "Number of infants"
      },
      pets: {
        type: "number",
        description: "Number of pets"
      },
      ignoreRobotsText: {
        type: "boolean",
        description: "Ignore robots.txt rules for this request"
      }
    },
    required: ["id"]
  }
};

const AIRBNB_TOOLS = [
  AIRBNB_SEARCH_TOOL,
  AIRBNB_LISTING_DETAILS_TOOL,
] as const;

// Utility functions
const USER_AGENT = "ModelContextProtocol/1.0 (Autonomous; +https://github.com/modelcontextprotocol/servers)";
const BASE_URL = "https://www.airbnb.com";

const args = process.argv.slice(2);
const IGNORE_ROBOTS_TXT = args.includes("--ignore-robots-txt");

const robotsErrorMessage = "This path is disallowed by Airbnb's robots.txt to this User-agent. You may or may not want to run the server with '--ignore-robots-txt' args"
let robotsTxtContent = "";

// Simple robots.txt fetch
async function fetchRobotsTxt() {
  if (IGNORE_ROBOTS_TXT) {
    return;
  }

  try {
    const response = await fetchWithUserAgent(`${BASE_URL}/robots.txt`);
    robotsTxtContent = await response.text();
  } catch (error) {
    console.error("Error fetching robots.txt:", error);
    robotsTxtContent = ""; // Empty robots.txt means everything is allowed
  }
}

function isPathAllowed(path: string) {  
  if (!robotsTxtContent) {
    return true; // If we couldn't fetch robots.txt, assume allowed
  }

  const robots = robotsParser(path, robotsTxtContent);
  if (!robots.isAllowed(path, USER_AGENT)) {
    console.error(robotsErrorMessage);
    return false;
  }
  
  return true;
}

async function fetchWithUserAgent(url: string) {
  return fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
}

// API handlers
async function handleAirbnbSearch(params: any) {
  const {
    location,
    placeId,
    checkin,
    checkout,
    adults = 1,
    children = 0,
    infants = 0,
    pets = 0,
    minPrice,
    maxPrice,
    cursor,
    ignoreRobotsText = false,
  } = params;

  // Build search URL
  const searchUrl = new URL(`${BASE_URL}/s/${encodeURIComponent(location)}/homes`);
  
  // Add placeId
  if (placeId) searchUrl.searchParams.append("place_id", placeId);
  
  // Add query parameters
  if (checkin) searchUrl.searchParams.append("checkin", checkin);
  if (checkout) searchUrl.searchParams.append("checkout", checkout);
  
  // Add guests
  const adults_int = parseInt(adults.toString());
  const children_int = parseInt(children.toString());
  const infants_int = parseInt(infants.toString());
  const pets_int = parseInt(pets.toString());
  
  const totalGuests = adults_int + children_int;
  if (totalGuests > 0) {
    searchUrl.searchParams.append("adults", adults_int.toString());
    searchUrl.searchParams.append("children", children_int.toString());
    searchUrl.searchParams.append("infants", infants_int.toString());
    searchUrl.searchParams.append("pets", pets_int.toString());
  }
  
  // Add price range
  if (minPrice) searchUrl.searchParams.append("price_min", minPrice.toString());
  if (maxPrice) searchUrl.searchParams.append("price_max", maxPrice.toString());
  
  // Add room type
  // if (roomType) {
  //   const roomTypeParam = roomType.toLowerCase().replace(/\s+/g, '_');
  //   searchUrl.searchParams.append("room_types[]", roomTypeParam);
  // }

  // Add cursor for pagination
  if (cursor) {
    searchUrl.searchParams.append("cursor", cursor);
  }

  // Check if path is allowed by robots.txt
  const path = searchUrl.pathname + searchUrl.search;
  if (!ignoreRobotsText && !isPathAllowed(path)) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: robotsErrorMessage,
          url: searchUrl.toString()
        }, null, 2)
      }],
      isError: true
    };
  }

  const allowSearchResultSchema: Record<string, any> = {
    listing : {
      id: true,
      name: true,
      title: true,
      coordinate: true,
      structuredContent: {
        mapCategoryInfo: {
          body: true
        },
        mapSecondaryLine: {
          body: true
        },
        primaryLine: {
          body: true
        },
        secondaryLine: {
          body: true
        },
      }
    },
    avgRatingA11yLabel: true,
    listingParamOverrides: true,
    structuredDisplayPrice: {
      primaryLine: {
        accessibilityLabel: true,
      },
      secondaryLine: {
        accessibilityLabel: true,
      },
      explanationData: {
        title: true,
        priceDetails: {
          items: {
            description: true,
            priceString: true
          }
        }
      }
    },
    // contextualPictures: {
    //   picture: true
    // }
  };

  try {
    const response = await fetchWithUserAgent(searchUrl.toString());
    const html = await response.text();
    const $ = cheerio.load(html);
    
    let staysSearchResults = {};
    
    try {
      const scriptElement = $("#data-deferred-state-0").first();
      const clientData = JSON.parse($(scriptElement).text()).niobeMinimalClientData[0][1];
      const results = clientData.data.presentation.staysSearch.results;
      cleanObject(results);
      staysSearchResults = {
        searchResults: results.searchResults
          .map((result: any) => flattenArraysInObject(pickBySchema(result, allowSearchResultSchema)))
          .map((result: any) => { return {url: `${BASE_URL}/rooms/${result.listing.id}`, ...result }}),
        paginationInfo: results.paginationInfo
      }
    } catch (e) {
        console.error(e);
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          searchUrl: searchUrl.toString(),
          ...staysSearchResults
        }, null, 2)
      }],
      isError: false
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
          searchUrl: searchUrl.toString()
        }, null, 2)
      }],
      isError: true
    };
  }
}

async function handleAirbnbListingDetails(params: any) {
  const {
    id,
    checkin,
    checkout,
    adults = 1,
    children = 0,
    infants = 0,
    pets = 0,
    ignoreRobotsText = false,
  } = params;

  // Build listing URL
  const listingUrl = new URL(`${BASE_URL}/rooms/${id}`);
  
  // Add query parameters
  if (checkin) listingUrl.searchParams.append("check_in", checkin);
  if (checkout) listingUrl.searchParams.append("check_out", checkout);
  
  // Add guests
  const adults_int = parseInt(adults.toString());
  const children_int = parseInt(children.toString());
  const infants_int = parseInt(infants.toString());
  const pets_int = parseInt(pets.toString());
  
  const totalGuests = adults_int + children_int;
  if (totalGuests > 0) {
    listingUrl.searchParams.append("adults", adults_int.toString());
    listingUrl.searchParams.append("children", children_int.toString());
    listingUrl.searchParams.append("infants", infants_int.toString());
    listingUrl.searchParams.append("pets", pets_int.toString());
  }

  // Check if path is allowed by robots.txt
  const path = listingUrl.pathname + listingUrl.search;
  if (!ignoreRobotsText && !isPathAllowed(path)) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: robotsErrorMessage,
          url: listingUrl.toString()
        }, null, 2)
      }],
      isError: true
    };
  }

  const allowSectionSchema: Record<string, any> = {
    "LOCATION_DEFAULT": {
      lat: true,
      lng: true,
      subtitle: true,
      title: true
    },
    "POLICIES_DEFAULT": {
      title: true,
      houseRulesSections: {
        title: true,
        items : {
          title: true
        }
      }
    },
    "HIGHLIGHTS_DEFAULT": {
      highlights: {
        title: true
      }
    },
    "DESCRIPTION_DEFAULT": {
      htmlDescription: {
        htmlText: true
      }
    },
    "AMENITIES_DEFAULT": {
      title: true,
      seeAllAmenitiesGroups: {
        title: true,
        amenities: {
          title: true
        }
      }
    },
    //"AVAILABLITY_CALENDAR_DEFAULT": true,
  };

  try {
    const response = await fetchWithUserAgent(listingUrl.toString());
    const html = await response.text();
    const $ = cheerio.load(html);
    
    let details = {};
    
    try {
      const scriptElement = $("#data-deferred-state-0").first();
      const clientData = JSON.parse($(scriptElement).text()).niobeMinimalClientData[0][1];
      const sections = clientData.data.presentation.stayProductDetailPage.sections.sections;
      sections.forEach((section: any) => cleanObject(section));
      details = sections
        .filter((section: any) => allowSectionSchema.hasOwnProperty(section.sectionId))
        .map((section: any) => {
          return {
            id: section.sectionId,
            ...flattenArraysInObject(pickBySchema(section.section, allowSectionSchema[section.sectionId]))
          }
        });
    } catch (e) {
        console.error(e);
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          listingUrl: listingUrl.toString(),
          url: listingUrl.toString(),
          details: details
        }, null, 2)
      }],
      isError: false
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
          listingUrl: listingUrl.toString()
        }, null, 2)
      }],
      isError: true
    };
  }
}

// Server setup
const server = new Server(
  {
    name: "airbnb",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

console.error(
  `Server started with options: ${IGNORE_ROBOTS_TXT ? "ignore-robots-txt" : "respect-robots-txt"}`
);

// Set up request handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: AIRBNB_TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    // Ensure robots.txt is loaded
    if (!robotsTxtContent) {
      await fetchRobotsTxt();
    }

    switch (request.params.name) {
      case "airbnb_search": {
        return await handleAirbnbSearch(request.params.arguments);
      }

      case "airbnb_listing_details": {
        return await handleAirbnbListingDetails(request.params.arguments);
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
    }
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Airbnb MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
