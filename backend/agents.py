from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.messages import ToolMessage
from dotenv import load_dotenv

try:
    from .tools import web_search, scrape_url
except ImportError:
    from tools import web_search, scrape_url

load_dotenv()

#model setup 
llm = ChatOpenAI(model = "gpt-4o-mini",temperature=0)


class SimpleAgent:
    def __init__(self, llm, tools):
        self.llm = llm
        self.tools = tools
        self.llm_with_tools = llm.bind_tools(tools)
        self.tool_map = {tool.name: tool for tool in tools}

    def invoke(self, state: dict) -> dict:
        messages = state.get("messages", [])
        current_messages = list(messages)
        
        response = self.llm_with_tools.invoke(current_messages)
        current_messages.append(response)
        
        if response.tool_calls:
            for tool_call in response.tool_calls:
                tool_name = tool_call["name"]
                tool_args = tool_call["args"]
                tool_obj = self.tool_map.get(tool_name)
                if tool_obj:
                    try:
                        tool_output = tool_obj.invoke(tool_args)
                    except Exception as e:
                        tool_output = f"Error running tool {tool_name}: {str(e)}"
                else:
                    tool_output = f"Error: Tool {tool_name} not found."
                
                current_messages.append(
                    ToolMessage(
                        content=str(tool_output),
                        tool_call_id=tool_call["id"],
                        name=tool_name
                    )
                )
            
            final_response = self.llm_with_tools.invoke(current_messages)
            current_messages.append(final_response)
            
        return {"messages": current_messages}


#Making the agents and chains available for import in pipeline.py

#1st agent 
def build_search_agent():
    return SimpleAgent(
        llm = llm,
        tools= [web_search]
    )

#2nd agent 

def build_reader_agent():
    return SimpleAgent(
        llm = llm,
        tools = [scrape_url]
    )


#writer chain 

writer_prompt = ChatPromptTemplate.from_messages([
    ("system", "You are an expert research writer. Write clear, structured and insightful reports."),
    ("human", """Write a detailed research report on the topic below.

Topic: {topic}

Research Gathered:
{research}

Structure the report as:
- Introduction
- Key Findings (minimum 3 well-explained points)
- Conclusion
- Sources (list all URLs found in the research)

Be detailed, factual and professional."""),
])

writer_chain = writer_prompt | llm | StrOutputParser()

#critic_chain 

critic_prompt = ChatPromptTemplate.from_messages([
     ("system", "You are a sharp and constructive research critic. Be honest and specific."),
    ("human", """Review the research report below and evaluate it strictly.

Report:
{report}

Respond in this exact format:

Score: X/10

Strengths:
- ...
- ...

Areas to Improve:
- ...
- ...

One line verdict:
..."""),
])

critic_chain = critic_prompt | llm | StrOutputParser()

/.