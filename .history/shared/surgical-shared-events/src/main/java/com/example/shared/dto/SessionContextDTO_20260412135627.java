import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;


@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class SessionContextDTO {
    private String sessionId;
    private ViewerType activeViewer;
    private SessionStatus status;
    private String activeResourceId;

    private Map<String, Object> viewerState;
}