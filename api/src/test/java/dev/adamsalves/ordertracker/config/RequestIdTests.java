package dev.adamsalves.ordertracker.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.RequestBuilder;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.datasource.url=jdbc:sqlite:./target/test-data/request-id.db")
class RequestIdTests {

    @Autowired
    private MockMvc mockMvc;

    /**
     * A refusal raised in the filter chain is the case the id has to survive: it is answered before
     * the dispatcher servlet, so a filter ordered behind security would never see the request. This
     * is what would notice if it stopped running first.
     */
    @Test
    void namesARequestRefusedBeforeItReachesTheApplication() throws Exception {
        mockMvc.perform(get("/api/orders"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().exists(RequestIdFilter.HEADER));
    }

    @Test
    void namesARequestItAnswers() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(header().exists(RequestIdFilter.HEADER));
    }

    @Test
    void givesEachRequestANameOfItsOwn() throws Exception {
        assertThat(idOf(get("/v3/api-docs"))).isNotEqualTo(idOf(get("/v3/api-docs")));
    }

    /**
     * The id is the API's own account of what it served, so it is minted here rather than taken from
     * whoever is asking. A caller that could name the request could write anything into the lines
     * that record it.
     */
    @Test
    void refusesToBeNamedByTheCaller() throws Exception {
        String supplied = "an-id-the-caller-chose";

        assertThat(idOf(get("/v3/api-docs").header(RequestIdFilter.HEADER, supplied)))
                .isNotEqualTo(supplied);
    }

    private String idOf(RequestBuilder request) throws Exception {
        return mockMvc.perform(request).andReturn().getResponse().getHeader(RequestIdFilter.HEADER);
    }
}
